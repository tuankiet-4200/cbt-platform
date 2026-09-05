import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  FileJson,
  FilePlus2,
  Layers3,
  Loader2,
  Play,
  RefreshCcw,
  Search,
  ShieldCheck,
  ListPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SelectField } from '@/components/ui/SelectField';
import {
  checkBlueprintAvailability,
  checkExamAvailability,
  createExam,
  generateExamDraft,
  listExamBlueprints,
  previewExam,
  publishExam,
  regenerateExamDraft,
  type AdminExam,
  type AvailabilityReport,
  type ExamAccessType,
  type ExamBlueprint,
  type ExamPreview,
  type GenerateResponse,
  type Shortage,
} from '../api/exams.api';
import type { ExamSectionType } from '@/features/exam/api/sessions.api';
import {
  EXAM_SECTION_DURATION_MINS,
  EXAM_SECTION_ORDER,
} from '@/features/exam/lib/exam-sections';
import { ExamPreviewModal } from './ExamPreviewModal';

export default function AdminExamCreatePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [creationMode, setCreationMode] = useState<'BLUEPRINT' | 'MANUAL'>('BLUEPRINT');
  const [createdExam, setCreatedExam] = useState<AdminExam | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMins, setDurationMins] = useState(150);
  const [contentFontSize, setContentFontSize] = useState(18);
  const [examScope, setExamScope] = useState<'ALL' | ExamSectionType>('ALL');
  const [accessType, setAccessType] = useState<ExamAccessType>('LOCKED');
  const [blueprintId, setBlueprintId] = useState('');
  const [blueprintText, setBlueprintText] = useState('');
  const [seed, setSeed] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityReport | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [preview, setPreview] = useState<ExamPreview | null>(null);

  const blueprintsQuery = useQuery({
    queryKey: ['admin', 'exam-blueprints'],
    queryFn: listExamBlueprints,
  });

  const usableBlueprints = useMemo(
    () => (blueprintsQuery.data ?? []).filter((blueprint) => blueprint.status !== 'ARCHIVED'),
    [blueprintsQuery.data],
  );
  const selectedBlueprint = usableBlueprints.find((blueprint) => blueprint.id === blueprintId) ?? usableBlueprints[0] ?? null;
  const scopedBlueprint = useMemo(
    () => selectedBlueprint
      ? selectBlueprintScope(selectedBlueprint.blueprintJson, examScope)
      : null,
    [examScope, selectedBlueprint],
  );

  useEffect(() => {
    if (!selectedBlueprint || !scopedBlueprint || createdExam) return;
    setBlueprintId(selectedBlueprint.id);
    setDurationMins(scopedBlueprint.durationMins ?? selectedBlueprint.durationMins);
    setBlueprintText(formatJson(scopedBlueprint));
  }, [createdExam, scopedBlueprint, selectedBlueprint]);

  const createMutation = useMutation({
    mutationFn: () => {
      if (creationMode === 'MANUAL') {
        const sections = examScope === 'ALL' ? EXAM_SECTION_ORDER : [examScope];
        return createExam({
          title,
          description,
          accessType,
          contentFontSize,
          blueprintJson: createManualBlueprint(sections),
        });
      }
      if (!selectedBlueprint || !scopedBlueprint) throw new Error('Chon blueprint truoc khi tao exam.');
      return createExam({
        title,
        description,
        durationMins,
        contentFontSize,
        accessType,
        blueprintId: selectedBlueprint.id,
        sectionTypes: scopedBlueprint.sections.map((section) => section.sectionType),
      });
    },
    onSuccess: (exam) => {
      setCreatedExam(exam);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
      if (creationMode === 'MANUAL') navigate(`/admin/exams/${exam.id}/edit`);
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Khong tao duoc exam.'),
  });

  const availabilityMutation = useMutation({
    mutationFn: () => {
      if (createdExam) return checkExamAvailability(createdExam.id);
      if (!scopedBlueprint) throw new Error('Chon blueprint truoc khi check availability.');
      return checkBlueprintAvailability(scopedBlueprint);
    },
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

  const applyBlueprint = (nextBlueprintId: string) => {
    const nextBlueprint = usableBlueprints.find((blueprint) => blueprint.id === nextBlueprintId);
    setBlueprintId(nextBlueprintId);
    if (nextBlueprint) {
      const nextScopedBlueprint = selectBlueprintScope(nextBlueprint.blueprintJson, examScope);
      setDurationMins(nextScopedBlueprint.durationMins ?? nextBlueprint.durationMins);
      setBlueprintText(formatJson(nextScopedBlueprint));
    }
    setAvailability(null);
    setGenerationResult(null);
    setPreview(null);
  };

  const applyExamScope = (scope: 'ALL' | ExamSectionType) => {
    setExamScope(scope);
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
          <p className="mt-1 text-sm text-neutral-500">Tạo đề thủ công từ ngân hàng câu hỏi hoặc sinh tự động theo blueprint.</p>
        </div>
        {createdExam && (
          <span className={cn('badge h-9 justify-center px-3', createdExam.isPublished ? 'badge-success' : 'badge-warning')}>
            {createdExam.isPublished ? 'Published' : 'Draft'}
          </span>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={Boolean(createdExam)} onClick={() => setCreationMode('MANUAL')} className={cn('card flex items-start gap-3 p-5 text-left transition', creationMode === 'MANUAL' && 'border-primary-400 bg-primary-50 ring-1 ring-primary-300')}>
          <ListPlus className="mt-0.5 h-5 w-5 text-primary-700" />
          <span><strong className="block text-neutral-900">Tạo đề thủ công</strong><span className="mt-1 block text-sm text-neutral-500">Tạo đề rỗng, sau đó tự chọn và sắp xếp từng câu hỏi hoặc bài đọc.</span></span>
        </button>
        <button type="button" disabled={Boolean(createdExam)} onClick={() => setCreationMode('BLUEPRINT')} className={cn('card flex items-start gap-3 p-5 text-left transition', creationMode === 'BLUEPRINT' && 'border-primary-400 bg-primary-50 ring-1 ring-primary-300')}>
          <FileJson className="mt-0.5 h-5 w-5 text-primary-700" />
          <span><strong className="block text-neutral-900">Tạo theo blueprint</strong><span className="mt-1 block text-sm text-neutral-500">Sinh tự động theo ma trận, độ khó và số lượng đã cấu hình.</span></span>
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <FilePlus2 className="h-4 w-4" />
              Exam metadata
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem_8rem_8rem_9rem]">
              <label className="block">
                <span className="label">Title</span>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} disabled={Boolean(createdExam)} />
              </label>
              <label className="block">
                <span className="label">Phạm vi bài thi</span>
                <SelectField
                  value={examScope}
                  options={[
                    { value: 'ALL', label: 'Đầy đủ 3 phần' },
                    { value: 'MATH', label: 'Chỉ Toán học' },
                    { value: 'READING', label: 'Chỉ Đọc hiểu' },
                    { value: 'SCIENCE', label: 'Chỉ Khoa học' },
                  ]}
                  disabled={Boolean(createdExam)}
                  onChange={(value) => applyExamScope(value as 'ALL' | ExamSectionType)}
                />
              </label>
              <label className="block">
                <span className="label">Duration</span>
                <input className="input" type="number" min={1} max={600} value={durationMins} onChange={(event) => setDurationMins(Number(event.target.value))} disabled />
              </label>
              <label className="block">
                <span className="label">Cỡ chữ</span>
                <SelectField
                  value={String(contentFontSize)}
                  options={[16, 18, 20, 22, 24].map((size) => ({
                    value: String(size),
                    label: `${size}px`,
                  }))}
                  disabled={Boolean(createdExam)}
                  onChange={(value) => setContentFontSize(Number(value))}
                />
              </label>
              <label className="block">
                <span className="label">Access</span>
                <SelectField
                  value={accessType}
                  options={[
                    { value: 'LOCKED', label: 'LOCKED' },
                    { value: 'PUBLIC', label: 'PUBLIC' },
                  ]}
                  disabled={Boolean(createdExam)}
                  onChange={(value) => setAccessType(value as ExamAccessType)}
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="label">Description</span>
              <textarea className="input min-h-20 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} disabled={Boolean(createdExam)} />
            </label>
            <div className="mt-5 flex justify-end">
              <button className="btn btn-primary btn-md" type="button" disabled={!title.trim() || (creationMode === 'BLUEPRINT' && !selectedBlueprint) || Boolean(createdExam) || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                {creationMode === 'MANUAL' ? 'Tạo và chọn nội dung' : 'Create draft shell'}
              </button>
            </div>
          </section>

          {creationMode === 'BLUEPRINT' && <section className="card p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                  <FileJson className="h-4 w-4" />
                  Blueprint
                </div>
                <p className="mt-1 text-sm text-neutral-500">{selectedBlueprint?.description ?? 'Chon mot blueprint template da duoc cau hinh.'}</p>
              </div>
              <label className="block lg:w-72">
                <span className="label">Blueprint</span>
                <SelectField
                  value={blueprintId}
                  options={usableBlueprints.map((blueprint) => ({
                    value: blueprint.id,
                    label: blueprint.name,
                    description: blueprint.status,
                  }))}
                  disabled={Boolean(createdExam) || blueprintsQuery.isLoading}
                  placeholder="Select blueprint"
                  onChange={applyBlueprint}
                />
              </label>
            </div>
            <textarea
              className="input mt-4 min-h-[28rem] resize-y font-mono text-xs"
              value={blueprintText}
              readOnly
            />
            {usableBlueprints.length === 0 && !blueprintsQuery.isLoading && (
              <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-700">
                Chua co blueprint nao kha dung. Hay tao blueprint truoc.
              </p>
            )}
            {formError && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>}
          </section>}

          {creationMode === 'BLUEPRINT' && <section className="grid gap-6 xl:grid-cols-2">
            <ReportPanel title="Availability" report={availability} shortages={availability?.shortages ?? []} />
            <ReportPanel title="Generation" report={generationResult} shortages={generationResult?.shortages ?? []} />
          </section>}
        </div>

        {creationMode === 'BLUEPRINT' ? <aside className="space-y-6">
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
              {createdExam && generationResult?.ok && (
                <Link className="btn btn-secondary btn-md" to={`/admin/exams/${createdExam.id}/edit`}>
                  <Layers3 className="h-4 w-4" />
                  Open editor
                </Link>
              )}
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
        </aside> : <aside className="space-y-6"><section className="card p-5"><h2 className="font-semibold text-neutral-900">Quy trình thủ công</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-neutral-600"><li>1. Nhập metadata và phạm vi bài thi.</li><li>2. Bấm “Tạo và chọn nội dung”.</li><li>3. Trong editor, thêm câu Toán hoặc bundle Đọc hiểu/Khoa học từ ngân hàng.</li><li>4. Sắp xếp, xem trước rồi publish.</li></ol></section></aside>}
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

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function selectBlueprintScope(
  blueprint: ExamBlueprint,
  scope: 'ALL' | ExamSectionType,
): ExamBlueprint {
  const selectedTypes = scope === 'ALL' ? EXAM_SECTION_ORDER : [scope];
  const sections = EXAM_SECTION_ORDER
    .filter((sectionType) => selectedTypes.includes(sectionType))
    .map((sectionType) =>
      blueprint.sections.find((section) => section.sectionType === sectionType),
    )
    .filter((section): section is ExamBlueprint['sections'][number] => Boolean(section));

  return {
    ...blueprint,
    durationMins: sections.reduce(
      (total, section) =>
        total + EXAM_SECTION_DURATION_MINS[section.sectionType],
      0,
    ),
    sections,
  };
}

function createManualBlueprint(sectionTypes: ExamSectionType[]): ExamBlueprint {
  return {
    version: 1,
    durationMins: sectionTypes.reduce((total, section) => total + EXAM_SECTION_DURATION_MINS[section], 0),
    sections: sectionTypes.map((sectionType) => ({
      sectionType,
      targetQuestionCount: sectionType === 'MATH' ? 1 : 0,
      ...(sectionType === 'MATH' ? {} : { targetBundleCount: 1 }),
    })),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
