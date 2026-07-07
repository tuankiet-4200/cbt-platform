import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  FileJson,
  FilePlus2,
  Loader2,
  Play,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  checkBlueprintAvailability,
  checkExamAvailability,
  createExam,
  generateExamDraft,
  previewExam,
  publishExam,
  regenerateExamDraft,
  updateExamBlueprint,
  type AdminExam,
  type AvailabilityReport,
  type ExamAccessType,
  type ExamBlueprint,
  type ExamPreview,
  type GenerateResponse,
  type Shortage,
} from '../api/exams.api';
import { ExamPreviewModal } from './ExamPreviewModal';

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

const BLUEPRINT_TEMPLATES = [
  {
    id: 'tsa-standard',
    name: 'TSA Standard Matrix',
    description: '50 Math questions, 2 Reading bundles, 3 Science bundles',
    blueprint: DEFAULT_BLUEPRINT,
  },
];

export default function AdminExamCreatePage() {
  const queryClient = useQueryClient();
  const [createdExam, setCreatedExam] = useState<AdminExam | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMins, setDurationMins] = useState(150);
  const [accessType, setAccessType] = useState<ExamAccessType>('LOCKED');
  const [templateId, setTemplateId] = useState(BLUEPRINT_TEMPLATES[0].id);
  const [blueprintText, setBlueprintText] = useState(formatJson(DEFAULT_BLUEPRINT));
  const [seed, setSeed] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityReport | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [preview, setPreview] = useState<ExamPreview | null>(null);

  const selectedTemplate = useMemo(
    () => BLUEPRINT_TEMPLATES.find((template) => template.id === templateId) ?? BLUEPRINT_TEMPLATES[0],
    [templateId],
  );

  const createMutation = useMutation({
    mutationFn: () => {
      const blueprint = parseBlueprint(blueprintText);
      return createExam({
        title,
        description,
        durationMins,
        accessType,
        blueprintJson: blueprint,
      });
    },
    onSuccess: (exam) => {
      setCreatedExam(exam);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong tao duoc exam.'),
  });

  const saveBlueprintMutation = useMutation({
    mutationFn: () => {
      if (!createdExam) throw new Error('Tao exam truoc khi luu blueprint.');
      return updateExamBlueprint(createdExam.id, parseBlueprint(blueprintText));
    },
    onSuccess: (exam) => {
      setCreatedExam(exam);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong luu duoc blueprint.'),
  });

  const availabilityMutation = useMutation({
    mutationFn: () => createdExam ? checkExamAvailability(createdExam.id) : checkBlueprintAvailability(parseBlueprint(blueprintText)),
    onSuccess: (result) => {
      setAvailability(result);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong kiem tra duoc availability.'),
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!createdExam) throw new Error('Tao exam truoc khi generate.');
      return generateExamDraft(createdExam.id, { seed: seed || undefined, maxAttempts });
    },
    onSuccess: (result) => {
      setGenerationResult(result);
      if (result.preview) setPreview(result.preview);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong generate duoc exam.'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => {
      if (!createdExam) throw new Error('Tao exam truoc khi regenerate.');
      return regenerateExamDraft(createdExam.id, { seed: seed || undefined, maxAttempts });
    },
    onSuccess: (result) => {
      setGenerationResult(result);
      if (result.preview) setPreview(result.preview);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong regenerate duoc exam.'),
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!createdExam) throw new Error('Tao exam truoc khi preview.');
      return previewExam(createdExam.id);
    },
    onSuccess: (result) => {
      setPreview(result);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong preview duoc exam.'),
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!createdExam) throw new Error('Tao exam truoc khi publish.');
      return publishExam(createdExam.id, !createdExam.isPublished);
    },
    onSuccess: (exam) => {
      setCreatedExam(exam);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong publish duoc exam.'),
  });

  const applyTemplate = (nextTemplateId: string) => {
    const nextTemplate = BLUEPRINT_TEMPLATES.find((template) => template.id === nextTemplateId) ?? BLUEPRINT_TEMPLATES[0];
    setTemplateId(nextTemplate.id);
    setDurationMins(nextTemplate.blueprint.durationMins ?? 150);
    setBlueprintText(formatJson(nextTemplate.blueprint));
    setAvailability(null);
    setGenerationResult(null);
    setPreview(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link to="/admin/exams" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-primary-700">
            <ArrowLeft className="h-4 w-4" />
            Back to exams
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-neutral-900">Create exam</h1>
          <p className="mt-1 text-sm text-neutral-500">Chon blueprint, tao metadata, generate draft va preview truoc khi publish.</p>
        </div>
        {createdExam && (
          <span className={cn('badge h-9 justify-center px-3', createdExam.isPublished ? 'badge-success' : 'badge-warning')}>
            {createdExam.isPublished ? 'Published' : 'Draft'}
          </span>
        )}
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <FilePlus2 className="h-4 w-4" />
              Exam metadata
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <label className="block">
                <span className="label">Title</span>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} disabled={Boolean(createdExam)} />
              </label>
              <label className="block">
                <span className="label">Duration</span>
                <input className="input" type="number" min={1} max={600} value={durationMins} onChange={(event) => setDurationMins(Number(event.target.value))} disabled={Boolean(createdExam)} />
              </label>
              <label className="block">
                <span className="label">Access</span>
                <select className="input" value={accessType} onChange={(event) => setAccessType(event.target.value as ExamAccessType)} disabled={Boolean(createdExam)}>
                  <option value="LOCKED">LOCKED</option>
                  <option value="PUBLIC">PUBLIC</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="label">Description</span>
              <textarea className="input min-h-20 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} disabled={Boolean(createdExam)} />
            </label>
            <div className="mt-5 flex justify-end">
              <button className="btn btn-primary btn-md" type="button" disabled={!title.trim() || Boolean(createdExam) || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                Create draft shell
              </button>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                  <FileJson className="h-4 w-4" />
                  Blueprint
                </div>
                <p className="mt-1 text-sm text-neutral-500">{selectedTemplate.description}</p>
              </div>
              <label className="block lg:w-72">
                <span className="label">Template</span>
                <select className="input" value={templateId} onChange={(event) => applyTemplate(event.target.value)} disabled={Boolean(createdExam)}>
                  {BLUEPRINT_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              className="input mt-4 min-h-[28rem] resize-y font-mono text-xs"
              value={blueprintText}
              onChange={(event) => setBlueprintText(event.target.value)}
            />
            <div className="mt-4 flex justify-end">
              <button className="btn btn-secondary btn-md" type="button" disabled={!createdExam || saveBlueprintMutation.isPending} onClick={() => saveBlueprintMutation.mutate()}>
                {saveBlueprintMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save blueprint
              </button>
            </div>
            {formError && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>}
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ReportPanel title="Availability" report={availability} shortages={availability?.shortages ?? []} />
            <ReportPanel title="Generation" report={generationResult} shortages={generationResult?.shortages ?? []} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <p className="text-sm font-semibold text-neutral-900">Generation controls</p>
            <label className="mt-4 block">
              <span className="label">Seed</span>
              <input className="input" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="optional" />
            </label>
            <label className="mt-4 block">
              <span className="label">Max attempts</span>
              <input className="input" type="number" min={1} max={25} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} />
            </label>
            <div className="mt-5 grid gap-2">
              <ActionButton icon={CheckCircle2} label="Check availability" pending={availabilityMutation.isPending} onClick={() => availabilityMutation.mutate()} />
              <ActionButton icon={Play} label="Generate draft" pending={generateMutation.isPending} disabled={!createdExam} onClick={() => generateMutation.mutate()} />
              <ActionButton icon={RefreshCcw} label="Regenerate" pending={regenerateMutation.isPending} disabled={!createdExam} onClick={() => regenerateMutation.mutate()} />
              <ActionButton icon={Search} label="Preview" pending={previewMutation.isPending} disabled={!createdExam} onClick={() => previewMutation.mutate()} />
              <ActionButton
                icon={ShieldCheck}
                label={createdExam?.isPublished ? 'Unpublish' : 'Publish'}
                pending={publishMutation.isPending}
                disabled={!createdExam}
                onClick={() => publishMutation.mutate()}
                primary
              />
            </div>
          </section>

          <section className="card p-5">
            <p className="text-sm font-semibold text-neutral-900">Draft state</p>
            <div className="mt-4 space-y-3">
              <StateRow label="Exam shell" done={Boolean(createdExam)} />
              <StateRow label="Availability checked" done={Boolean(availability)} />
              <StateRow label="Draft generated" done={Boolean(generationResult?.ok)} />
              <StateRow label="Preview ready" done={Boolean(preview)} />
            </div>
          </section>
        </aside>
      </section>

      {preview && <ExamPreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function ActionButton({ icon: Icon, label, pending, disabled, primary, onClick }: {
  icon: typeof CheckCircle2;
  label: string;
  pending?: boolean;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={cn('btn btn-md', primary ? 'btn-primary' : 'btn-secondary')} type="button" disabled={disabled || pending} onClick={onClick}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function ReportPanel({ title, report, shortages }: { title: string; report: unknown; shortages: Shortage[] }) {
  const ok = Boolean(report && typeof report === 'object' && 'ok' in report && (report as { ok?: boolean }).ok);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-neutral-900">{title}</h2>
        {Boolean(report) && <span className={cn('badge', ok ? 'badge-success' : 'badge-danger')}>{ok ? 'OK' : 'Needs content'}</span>}
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
        <p className="mt-4 text-sm text-neutral-500">{report ? 'Khong co shortage.' : 'Chua chay kiem tra.'}</p>
      )}
    </div>
  );
}

function StateRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className={cn('badge', done ? 'badge-success' : 'badge-neutral')}>{done ? 'Done' : 'Waiting'}</span>
    </div>
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
