import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  FileJson,
  GraduationCap,
  Loader2,
  Play,
  Plus,
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
  listExams,
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
import type { CognitiveLevel, ExamSectionType } from '../api/questionBank.api';

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

const SECTIONS: ExamSectionType[] = ['MATH', 'READING', 'SCIENCE'];
const LEVELS: CognitiveLevel[] = ['RECOGNITION', 'COMPREHENSION', 'APPLICATION', 'HIGH_APPLICATION'];

export default function AdminExamsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ExamSectionType>('MATH');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMins, setDurationMins] = useState(150);
  const [accessType, setAccessType] = useState<ExamAccessType>('LOCKED');
  const [blueprintText, setBlueprintText] = useState(formatJson(DEFAULT_BLUEPRINT));
  const [seed, setSeed] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [formError, setFormError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityReport | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [preview, setPreview] = useState<ExamPreview | null>(null);

  const examsQuery = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: listExams,
  });

  const exams = examsQuery.data ?? [];
  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedId) ?? exams[0] ?? null,
    [exams, selectedId],
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
      setSelectedId(exam.id);
      setTitle('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không tạo được exam.'),
  });

  const saveBlueprintMutation = useMutation({
    mutationFn: () => {
      if (!selectedExam) throw new Error('Chọn một exam trước.');
      return updateExamBlueprint(selectedExam.id, parseBlueprint(blueprintText));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không lưu được blueprint.'),
  });

  const availabilityMutation = useMutation({
    mutationFn: () => selectedExam ? checkExamAvailability(selectedExam.id) : checkBlueprintAvailability(parseBlueprint(blueprintText)),
    onSuccess: setAvailability,
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không kiểm tra được availability.'),
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!selectedExam) throw new Error('Chọn một exam trước.');
      return generateExamDraft(selectedExam.id, { seed: seed || undefined, maxAttempts });
    },
    onSuccess: (result) => {
      setGenerationResult(result);
      if (result.preview) setPreview(result.preview);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không generate được exam.'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => {
      if (!selectedExam) throw new Error('Chọn một exam trước.');
      return regenerateExamDraft(selectedExam.id, { seed: seed || undefined, maxAttempts });
    },
    onSuccess: (result) => {
      setGenerationResult(result);
      if (result.preview) setPreview(result.preview);
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
    },
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không regenerate được exam.'),
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!selectedExam) throw new Error('Chọn một exam trước.');
      return previewExam(selectedExam.id);
    },
    onSuccess: setPreview,
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không preview được exam.'),
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!selectedExam) throw new Error('Chọn một exam trước.');
      return publishExam(selectedExam.id, !selectedExam.isPublished);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] }),
    onError: (error) => setFormError(getErrorMessage(error) ?? 'Không publish được exam.'),
  });

  const loadExamIntoEditor = (exam: AdminExam) => {
    setSelectedId(exam.id);
    setBlueprintText(formatJson(exam.blueprintJson ?? DEFAULT_BLUEPRINT));
    setSeed(exam.generationSeed ?? '');
    setAvailability(null);
    setGenerationResult(null);
    setPreview(null);
    setFormError(null);
  };

  const selectedPreview = preview;
  const activePreview = selectedPreview?.sections[activeSection];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <GraduationCap className="h-4 w-4" />
            Exam Management
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quản lý đề thi</h1>
          <p className="mt-1 text-sm text-neutral-500">Tạo blueprint, kiểm tra nguồn câu hỏi, generate draft và publish sau khi preview.</p>
        </div>
        <span className="badge badge-neutral h-9 justify-center px-3">{exams.length} exams</span>
      </header>

      <section className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="card overflow-hidden">
          <div className="border-b border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Search className="h-4 w-4" />
              {examsQuery.isFetching ? 'Đang tải...' : 'Exam list'}
            </div>
          </div>
          <div className="max-h-[42rem] overflow-y-auto">
            {exams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => loadExamIntoEditor(exam)}
                className={cn(
                  'block w-full border-b border-neutral-100 p-4 text-left transition hover:bg-neutral-50',
                  selectedExam?.id === exam.id && 'bg-primary-50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-neutral-900">{exam.title}</p>
                    <p className="mt-1 text-xs text-neutral-500">{exam.durationMins} phút · {exam.accessType}</p>
                  </div>
                  <span className={cn('badge', exam.isPublished ? 'badge-success' : 'badge-warning')}>
                    {exam.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-500">
                  <MetricMini label="M" value={exam.counts.mathQuestions} />
                  <MetricMini label="R" value={exam.counts.readingQuestions} />
                  <MetricMini label="S" value={exam.counts.scienceQuestions} />
                </div>
              </button>
            ))}
            {!examsQuery.isLoading && exams.length === 0 && (
              <p className="p-8 text-center text-sm text-neutral-500">Chưa có exam.</p>
            )}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Plus className="h-4 w-4" />
              Create exam metadata
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
              <label className="block">
                <span className="label">Title</span>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="block">
                <span className="label">Duration</span>
                <input className="input" type="number" min={1} max={600} value={durationMins} onChange={(event) => setDurationMins(Number(event.target.value))} />
              </label>
              <label className="block">
                <span className="label">Access</span>
                <select className="input" value={accessType} onChange={(event) => setAccessType(event.target.value as ExamAccessType)}>
                  <option value="LOCKED">LOCKED</option>
                  <option value="PUBLIC">PUBLIC</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="label">Description</span>
              <textarea className="input min-h-20 resize-y" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <div className="mt-5 flex justify-end">
              <button className="btn btn-primary btn-md" type="button" disabled={!title.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create exam
              </button>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                    <FileJson className="h-4 w-4" />
                    Blueprint editor
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{selectedExam ? selectedExam.title : 'Chọn hoặc tạo exam để lưu blueprint.'}</p>
                </div>
                <button className="btn btn-secondary btn-md" type="button" disabled={!selectedExam || saveBlueprintMutation.isPending} onClick={() => saveBlueprintMutation.mutate()}>
                  {saveBlueprintMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save blueprint
                </button>
              </div>
              <textarea
                className="input mt-4 min-h-[28rem] resize-y font-mono text-xs"
                value={blueprintText}
                onChange={(event) => setBlueprintText(event.target.value)}
              />
              {formError && <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>}
            </div>

            <aside className="card p-5">
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
                <ActionButton icon={Play} label="Generate draft" pending={generateMutation.isPending} disabled={!selectedExam} onClick={() => generateMutation.mutate()} />
                <ActionButton icon={RefreshCcw} label="Regenerate" pending={regenerateMutation.isPending} disabled={!selectedExam} onClick={() => regenerateMutation.mutate()} />
                <ActionButton icon={Search} label="Preview" pending={previewMutation.isPending} disabled={!selectedExam} onClick={() => previewMutation.mutate()} />
                <ActionButton
                  icon={ShieldCheck}
                  label={selectedExam?.isPublished ? 'Unpublish' : 'Publish'}
                  pending={publishMutation.isPending}
                  disabled={!selectedExam}
                  onClick={() => publishMutation.mutate()}
                  primary
                />
              </div>
            </aside>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ReportPanel title="Availability" report={availability} shortages={availability?.shortages ?? []} />
            <ReportPanel title="Generation" report={generationResult} shortages={generationResult?.shortages ?? []} />
          </section>

          <section className="card p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-neutral-900">Generated preview</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {selectedPreview ? `Seed ${selectedPreview.generationSeed ?? '-'} · ${selectedPreview.totalPoints} points` : 'Generate hoặc preview để xem breakdown.'}
                </p>
              </div>
              <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-2 sm:grid-cols-3">
                {SECTIONS.map((section) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      'h-10 rounded-md px-4 text-sm font-semibold transition',
                      activeSection === section ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100',
                    )}
                  >
                    {section}
                  </button>
                ))}
              </div>
            </div>
            {activePreview ? (
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <MetricCard label="Items" value={activePreview.itemCount} />
                <MetricCard label="Questions" value={activePreview.questionCount} />
                <MetricCard label="Status" value={selectedPreview?.isPublished ? 'Published' : 'Draft'} />
                <div className="md:col-span-3">
                  <h3 className="text-sm font-semibold text-neutral-800">Difficulty</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {LEVELS.map((level) => <MetricMini key={level} label={level} value={activePreview.difficulty[level] ?? 0} />)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-5 rounded-lg bg-neutral-50 p-6 text-center text-sm text-neutral-500">Chưa có preview.</p>
            )}
          </section>
        </div>
      </section>
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
        <p className="mt-4 text-sm text-neutral-500">{report ? 'Không có shortage.' : 'Chưa chạy kiểm tra.'}</p>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <p className="text-[0.68rem] font-semibold uppercase text-neutral-500">{label}</p>
      <p className="mt-1 font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function parseBlueprint(value: string): ExamBlueprint {
  const parsed = JSON.parse(value) as ExamBlueprint;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sections)) {
    throw new Error('Blueprint JSON cần có version=1 và sections[].');
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
