import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileJson, Loader2, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  checkExamBlueprintTemplateAvailability,
  createExamBlueprint,
  listExamBlueprints,
  updateExamBlueprintTemplate,
  type AdminExamBlueprint,
  type AvailabilityReport,
  type ExamBlueprint,
  type ExamBlueprintStatus,
  type Shortage,
} from '../api/exams.api';

const DEFAULT_BLUEPRINT: ExamBlueprint = {
  version: 1,
  durationMins: 150,
  randomization: {
    seed: 'tsa-admin-draft',
    maxAttempts: 5,
  },
  sections: [
    { sectionType: 'MATH', targetQuestionCount: 50 },
    { sectionType: 'READING', targetBundleCount: 2, targetQuestionCount: 20 },
    { sectionType: 'SCIENCE', targetBundleCount: 3, targetQuestionCount: 15 },
  ],
};

export default function AdminExamBlueprintsPage() {
  const queryClient = useQueryClient();
  const [editingBlueprint, setEditingBlueprint] = useState<AdminExamBlueprint | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ExamBlueprintStatus>('ACTIVE');
  const [durationMins, setDurationMins] = useState(150);
  const [blueprintText, setBlueprintText] = useState(formatJson(DEFAULT_BLUEPRINT));
  const [formError, setFormError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityReport | null>(null);

  const blueprintsQuery = useQuery({
    queryKey: ['admin', 'exam-blueprints'],
    queryFn: listExamBlueprints,
  });

  const blueprints = blueprintsQuery.data ?? [];
  const activeCount = useMemo(() => blueprints.filter((blueprint) => blueprint.status === 'ACTIVE').length, [blueprints]);

  const createMutation = useMutation({
    mutationFn: () => createExamBlueprint({
      name,
      description,
      durationMins,
      status,
      blueprintJson: parseBlueprint(blueprintText),
    }),
    onSuccess: () => {
      closeEditor();
      queryClient.invalidateQueries({ queryKey: ['admin', 'exam-blueprints'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong tao duoc blueprint.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingBlueprint) throw new Error('Select a blueprint first.');
      return updateExamBlueprintTemplate(editingBlueprint.id, {
        name,
        description,
        durationMins,
        status,
        blueprintJson: parseBlueprint(blueprintText),
      });
    },
    onSuccess: () => {
      closeEditor();
      queryClient.invalidateQueries({ queryKey: ['admin', 'exam-blueprints'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong luu duoc blueprint.'),
  });

  const availabilityMutation = useMutation({
    mutationFn: () => {
      if (!editingBlueprint) throw new Error('Luu blueprint truoc khi check availability.');
      return checkExamBlueprintTemplateAvailability(editingBlueprint.id);
    },
    onSuccess: (result) => {
      setAvailability(result);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong check duoc availability.'),
  });

  const openCreate = () => {
    setEditingBlueprint(null);
    setName('TSA Standard Matrix');
    setDescription('50 Math questions, 2 Reading bundles, 3 Science bundles');
    setStatus('ACTIVE');
    setDurationMins(150);
    setBlueprintText(formatJson(DEFAULT_BLUEPRINT));
    setAvailability(null);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const openEdit = (blueprint: AdminExamBlueprint) => {
    setEditingBlueprint(blueprint);
    setName(blueprint.name);
    setDescription(blueprint.description ?? '');
    setStatus(blueprint.status);
    setDurationMins(blueprint.durationMins);
    setBlueprintText(formatJson(blueprint.blueprintJson));
    setAvailability(null);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingBlueprint(null);
    setFormError(null);
    setAvailability(null);
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <FileJson className="h-4 w-4" />
            Blueprint Management
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quan ly ma tran de</h1>
          <p className="mt-1 text-sm text-neutral-500">Quan ly blueprint template de generate exam snapshot.</p>
        </div>
        <button type="button" className="btn btn-primary btn-md" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create blueprint
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Total blueprints" value={blueprints.length} />
        <Metric label="Active" value={activeCount} />
        <Metric label="Used by exams" value={blueprints.reduce((sum, blueprint) => sum + blueprint.counts.exams, 0)} />
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Duration</Th>
                <Th>Exams</Th>
                <Th>Updated</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {blueprints.map((blueprint) => (
                <tr key={blueprint.id} className="hover:bg-neutral-50">
                  <td className="min-w-80 px-4 py-4">
                    <p className="font-semibold text-neutral-900">{blueprint.name}</p>
                    <p className="mt-1 text-sm text-neutral-500">{blueprint.description ?? 'No description'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn('badge', blueprint.status === 'ACTIVE' ? 'badge-success' : blueprint.status === 'ARCHIVED' ? 'badge-neutral' : 'badge-warning')}>
                      {blueprint.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-neutral-600">{blueprint.durationMins} phut</td>
                  <td className="px-4 py-4 text-sm text-neutral-600">{blueprint.counts.exams}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-neutral-500">{formatDateTime(blueprint.updatedAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(blueprint)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blueprintsQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Dang tai blueprints...
          </div>
        )}
        {!blueprintsQuery.isLoading && blueprints.length === 0 && (
          <p className="p-8 text-center text-sm text-neutral-500">Chua co blueprint.</p>
        )}
      </section>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/40 px-4 py-6 backdrop-blur-sm">
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                  <FileJson className="h-4 w-4" />
                  {editingBlueprint ? 'Edit blueprint' : 'Create blueprint'}
                </div>
                <h2 className="mt-1 text-xl font-bold text-neutral-900">{editingBlueprint ? editingBlueprint.name : 'New exam blueprint'}</h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
                aria-label="Close blueprint editor"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
                <label className="block">
                  <span className="label">Name</span>
                  <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="block">
                  <span className="label">Duration</span>
                  <input className="input" type="number" min={1} max={600} value={durationMins} onChange={(event) => setDurationMins(Number(event.target.value))} />
                </label>
                <label className="block">
                  <span className="label">Status</span>
                  <select className="input" value={status} onChange={(event) => setStatus(event.target.value as ExamBlueprintStatus)}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </label>
              </div>
              <label className="mt-4 block">
                <span className="label">Description</span>
                <textarea className="input min-h-20 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label className="mt-4 block">
                <span className="label">Blueprint JSON</span>
                <textarea className="input min-h-[26rem] resize-y font-mono text-xs" value={blueprintText} onChange={(event) => setBlueprintText(event.target.value)} />
              </label>

              {formError && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>}
              {availability && <ReportPanel report={availability} shortages={availability.shortages} />}
            </div>

            <footer className="flex flex-col gap-2 border-t border-neutral-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" className="btn btn-secondary btn-md" onClick={closeEditor} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="btn btn-secondary btn-md" onClick={() => availabilityMutation.mutate()} disabled={!editingBlueprint || availabilityMutation.isPending}>
                {availabilityMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Check availability
              </button>
              <button type="button" className="btn btn-primary btn-md" onClick={() => (editingBlueprint ? updateMutation.mutate() : createMutation.mutate())} disabled={pending || !name.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                Save blueprint
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportPanel({ report, shortages }: { report: AvailabilityReport; shortages: Shortage[] }) {
  return (
    <div className="mt-4 rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-neutral-900">Availability</h3>
        <span className={cn('badge', report.ok ? 'badge-success' : 'badge-danger')}>{report.ok ? 'OK' : 'Needs content'}</span>
      </div>
      {shortages.length > 0 ? (
        <div className="mt-4 space-y-2">
          {shortages.map((shortage, index) => (
            <div key={`${shortage.section}-${shortage.constraint}-${index}`} className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
              <strong>{shortage.section}</strong> · {shortage.constraint}: required {shortage.required}, available {shortage.available}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">Khong co shortage.</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500', align === 'right' ? 'text-right' : 'text-left')}>
      {children}
    </th>
  );
}

function parseBlueprint(value: string): ExamBlueprint {
  const parsed = JSON.parse(value) as ExamBlueprint;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sections)) {
    throw new Error('Blueprint JSON can co version=1 va sections[].');
  }
  return parsed;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
