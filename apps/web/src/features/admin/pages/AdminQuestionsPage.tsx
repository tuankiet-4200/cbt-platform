import { useMemo, useState } from 'react';
import type { Dispatch, ElementType, ReactNode, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Loader2,
  Plus,
  Sigma,
  Trash2,
  Upload,
} from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import { cn } from '@/lib/utils';
import {
  bulkCreateQuestions,
  createPassageBundleWithQuestions,
  createQuestion,
  listPassageBundles,
  listQuestions,
  listTags,
  type AdminQuestion,
  type CognitiveLevel,
  type CreatePassageBundleWithQuestionsPayload,
  type CreateQuestionPayload,
  type PassageBundle,
  type QuestionStatus,
  type QuestionType,
  type RichTextNode,
  type TagNode,
} from '../api/questionBank.api';

type SectionMode = 'MATH' | 'READING' | 'SCIENCE';

interface ChoiceOptionState {
  id: string;
  content: string;
  isCorrect: boolean;
}

interface StatementState {
  id: string;
  content: string;
  isTrue: boolean;
}

interface DragItemState {
  id: string;
  content: string;
}

interface DragSlotState {
  id: string;
  label: string;
  correctItemId: string;
}

interface FillBlankState {
  id: string;
  correctValue: number;
  unit: string;
}

interface IrtState {
  a: number;
  b: number;
  c: number;
}

interface QuestionDraft {
  type: QuestionType;
  level: CognitiveLevel;
  expectedTimeSecs: number;
  stem: string;
  solution: string;
  irtParams: IrtState;
  choices: ChoiceOptionState[];
  statements: StatementState[];
  dragItems: DragItemState[];
  dragSlots: DragSlotState[];
  fillBlanks: FillBlankState[];
}

const SECTIONS: Array<{ value: SectionMode; label: string; icon: ElementType; description: string }> = [
  { value: 'MATH', label: 'MATH', icon: Sigma, description: 'Nhập câu hỏi độc lập và gắn tag cho từng câu.' },
  { value: 'READING', label: 'READING', icon: BookOpen, description: 'Nhập passage và đúng 10 câu hỏi thuộc passage.' },
  { value: 'SCIENCE', label: 'SCIENCE', icon: FlaskConical, description: 'Nhập stimulus khoa học và đúng 5 câu hỏi thuộc stimulus.' },
];

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: 'SINGLE_CHOICE', label: 'Single choice' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple choice' },
  { value: 'TRUE_FALSE_MATRIX', label: 'True/False matrix' },
  { value: 'DRAG_DROP', label: 'Drag drop' },
  { value: 'FILL_NUMBER', label: 'Fill number' },
];

const LEVELS: Array<{ value: CognitiveLevel; label: string }> = [
  { value: 'RECOGNITION', label: 'Nhận biết' },
  { value: 'COMPREHENSION', label: 'Thông hiểu' },
  { value: 'APPLICATION', label: 'Vận dụng' },
  { value: 'HIGH_APPLICATION', label: 'Vận dụng cao' },
];

const STATUSES: Array<{ value: QuestionStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const BUNDLE_COUNTS: Record<Exclude<SectionMode, 'MATH'>, number> = {
  READING: 10,
  SCIENCE: 5,
};

export default function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SectionMode>('MATH');
  const [status, setStatus] = useState<QuestionStatus>('DRAFT');
  const [mathDraft, setMathDraft] = useState<QuestionDraft>(() => createQuestionDraft());
  const [mathTagIds, setMathTagIds] = useState<string[]>([]);
  const [bundleTagIds, setBundleTagIds] = useState<string[]>([]);
  const [bundleTitle, setBundleTitle] = useState('');
  const [bundlePassage, setBundlePassage] = useState('');
  const [bundleExpectedTimeSecs, setBundleExpectedTimeSecs] = useState(900);
  const [bundleDrafts, setBundleDrafts] = useState<QuestionDraft[]>(() => createBundleDrafts('READING'));
  const [activeBundleIndex, setActiveBundleIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkJson, setBulkJson] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: listTags,
  });

  const mathQuestionsQuery = useQuery({
    queryKey: ['admin', 'questions', 'math-bank'],
    queryFn: () => listQuestions({ page: 1, limit: 12, standaloneOnly: true, sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  const bundlesQuery = useQuery({
    queryKey: ['admin', 'passage-bundles', section],
    queryFn: () =>
      section === 'MATH'
        ? Promise.resolve({ data: [] as PassageBundle[] })
        : listPassageBundles({ page: 1, limit: 12, sectionType: section }),
  });

  const createMathMutation = useMutation({
    mutationFn: (payload: CreateQuestionPayload) => createQuestion(payload),
    onSuccess: () => {
      setMathDraft(createQuestionDraft());
      setMathTagIds([]);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
    },
  });

  const createBundleMutation = useMutation({
    mutationFn: (payload: CreatePassageBundleWithQuestionsPayload) => createPassageBundleWithQuestions(payload),
    onSuccess: () => {
      resetBundleForm(section);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'passage-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (questions: CreateQuestionPayload[]) => bulkCreateQuestions(questions),
    onSuccess: () => {
      setBulkJson('');
      setBulkError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
    },
  });

  const activeBundleDraft = bundleDrafts[activeBundleIndex] ?? bundleDrafts[0];
  const sectionMeta = SECTIONS.find((item) => item.value === section) ?? SECTIONS[0];
  const bundleCount = section === 'MATH' ? 0 : BUNDLE_COUNTS[section];
  const flatTags = useMemo(() => flattenTags(tagsQuery.data ?? []), [tagsQuery.data]);

  const handleSectionChange = (nextSection: SectionMode) => {
    setSection(nextSection);
    setFormError(null);
    if (nextSection !== 'MATH') resetBundleForm(nextSection);
  };

  const createMathQuestion = () => {
    setFormError(null);
    const contentJson = buildQuestionContent(mathDraft);
    const validation = validateQuestionDraft(contentJson);
    if (validation) {
      setFormError(validation);
      return;
    }

    createMathMutation.mutate({
      type: mathDraft.type,
      status,
      level: mathDraft.level,
      expectedTimeSecs: mathDraft.expectedTimeSecs,
      irtParams: mathDraft.irtParams,
      tagIds: mathTagIds,
      contentJson,
    });
  };

  const createBundle = () => {
    if (section === 'MATH') return;
    setFormError(null);

    const passageContent = parseRichText(bundlePassage);
    if (!bundleTitle.trim()) {
      setFormError('Bundle title không được để trống.');
      return;
    }
    if (passageContent.length === 0) {
      setFormError('Passage/stimulus không được để trống.');
      return;
    }
    if (bundleDrafts.length !== bundleCount) {
      setFormError(`${section} cần đúng ${bundleCount} câu hỏi.`);
      return;
    }

    const questionPayloads = bundleDrafts.map((draft, index) => {
      const contentJson = buildQuestionContent(draft);
      const validation = validateQuestionDraft(contentJson);
      if (validation) throw new Error(`Câu ${index + 1}: ${validation}`);

      return {
        type: draft.type,
        status,
        level: draft.level,
        expectedTimeSecs: draft.expectedTimeSecs,
        irtParams: draft.irtParams,
        contentJson,
        points: 1,
      };
    });

    try {
      createBundleMutation.mutate({
        sectionType: section,
        title: bundleTitle,
        status,
        expectedTimeSecs: bundleExpectedTimeSecs,
        contentJson: passageContent,
        tagIds: bundleTagIds,
        questions: questionPayloads,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Bundle payload không hợp lệ.');
    }
  };

  const submitBulkImport = () => {
    setBulkError(null);
    try {
      const parsed = JSON.parse(bulkJson) as unknown;
      const questions = Array.isArray(parsed)
        ? parsed
        : isQuestionEnvelope(parsed)
          ? parsed.questions
          : null;

      if (!questions || questions.length === 0) {
        setBulkError('JSON cần là mảng questions hoặc object { "questions": [...] }.');
        return;
      }
      if (questions.length > 100) {
        setBulkError('Bulk import tối đa 100 câu hỏi mỗi lần.');
        return;
      }

      bulkCreateMutation.mutate(questions as CreateQuestionPayload[]);
    } catch {
      setBulkError('JSON không hợp lệ.');
    }
  };

  function resetBundleForm(nextSection: SectionMode) {
    if (nextSection === 'MATH') return;
    setBundleTitle('');
    setBundlePassage('');
    setBundleExpectedTimeSecs(nextSection === 'READING' ? 1200 : 900);
    setBundleTagIds([]);
    setBundleDrafts(createBundleDrafts(nextSection));
    setActiveBundleIndex(0);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Database className="h-4 w-4" />
            Section Content Bank
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quản lý nội dung câu hỏi</h1>
          <p className="mt-1 text-sm text-neutral-500">{sectionMeta.description}</p>
        </div>
        <div className="grid gap-2 rounded-lg border border-neutral-200 bg-white p-2 sm:grid-cols-3">
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSectionChange(value)}
              className={cn(
                'flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition',
                section === value ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_34rem]">
        <div className="card p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Status">
              <select className="input" value={status} onChange={(event) => setStatus(event.target.value as QuestionStatus)}>
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </Field>
            {section !== 'MATH' && (
              <>
                <Field label="Bundle title">
                  <input className="input" value={bundleTitle} onChange={(event) => setBundleTitle(event.target.value)} />
                </Field>
                <Field label="Bundle time">
                  <input
                    className="input"
                    type="number"
                    min={60}
                    max={7200}
                    value={bundleExpectedTimeSecs}
                    onChange={(event) => setBundleExpectedTimeSecs(Number(event.target.value))}
                  />
                </Field>
              </>
            )}
          </div>

          {section === 'MATH' ? (
            <>
              <QuestionEditor draft={mathDraft} setDraft={setMathDraft} title="MATH question" />
              <div className="mt-5 border-t border-neutral-200 pt-5">
                <TagPicker title="Question tags" tags={flatTags} selectedIds={mathTagIds} onChange={setMathTagIds} />
              </div>
              <SubmitBar
                error={formError ?? getErrorMessage(createMathMutation.error)}
                isPending={createMathMutation.isPending}
                onSubmit={createMathQuestion}
                submitLabel="Lưu câu hỏi MATH"
              />
            </>
          ) : (
            <>
              <div className="mt-5 grid gap-4">
                <Field label={section === 'READING' ? 'Reading passage' : 'Science stimulus'}>
                  <textarea
                    className="input min-h-44 resize-y"
                    value={bundlePassage}
                    onChange={(event) => setBundlePassage(event.target.value)}
                    placeholder="Hỗ trợ LaTeX inline bằng $...$ và block bằng $$...$$"
                  />
                </Field>
                <TagPicker title="PassageBundle tags" tags={flatTags} selectedIds={bundleTagIds} onChange={setBundleTagIds} />
              </div>

              <div className="mt-5 border-t border-neutral-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-neutral-900">{section} questions</h2>
                  <span className="badge badge-warning">{bundleCount} required</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {bundleDrafts.map((draft, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setActiveBundleIndex(index)}
                      className={cn(
                        'h-9 min-w-10 rounded-md border px-3 text-sm font-semibold',
                        activeBundleIndex === index
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : validateQuestionDraft(buildQuestionContent(draft))
                            ? 'border-warning-300 bg-warning-50 text-warning-700'
                            : 'border-success-300 bg-success-50 text-success-700',
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
                {activeBundleDraft && (
                  <QuestionEditor
                    draft={activeBundleDraft}
                    setDraft={(updater) =>
                      setBundleDrafts((items) =>
                        items.map((item, index) =>
                          index === activeBundleIndex
                            ? typeof updater === 'function'
                              ? (updater as (value: QuestionDraft) => QuestionDraft)(item)
                              : updater
                            : item,
                        ),
                      )
                    }
                    title={`Question ${activeBundleIndex + 1}`}
                  />
                )}
              </div>

              <SubmitBar
                error={formError ?? getErrorMessage(createBundleMutation.error)}
                isPending={createBundleMutation.isPending}
                onSubmit={createBundle}
                submitLabel={`Tạo ${section} bundle`}
              />
            </>
          )}
        </div>

        <aside className="card p-5">
          <div className="mb-5 flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary-600" />
            <h2 className="font-semibold text-neutral-900">Preview</h2>
          </div>
          {section === 'MATH' ? (
            <QuestionPreview draft={mathDraft} />
          ) : (
            <div className="space-y-4">
              <PreviewBlock title={section === 'READING' ? 'Passage' : 'Stimulus'} nodes={parseRichText(bundlePassage)} />
              {activeBundleDraft && <QuestionPreview draft={activeBundleDraft} title={`Question ${activeBundleIndex + 1}`} />}
            </div>
          )}
        </aside>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-900">
            {section === 'MATH' ? 'Recent standalone MATH questions' : `Recent ${section} bundles`}
          </h2>
        </div>
        {section === 'MATH' ? (
          <QuestionList questions={mathQuestionsQuery.data?.data ?? []} />
        ) : (
          <BundleList bundles={bundlesQuery.data?.data ?? []} />
        )}
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Upload className="h-4 w-4" />
              Bulk JSON import
            </div>
            <p className="mt-1 text-sm text-neutral-500">Nhập nhanh tối đa 100 câu hỏi độc lập theo schema QuestionContent v2.</p>
          </div>
          <button className="btn btn-primary btn-md" type="button" disabled={bulkCreateMutation.isPending} onClick={submitBulkImport}>
            {bulkCreateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </button>
        </div>
        <textarea
          className="input mt-4 min-h-40 resize-y font-mono text-xs"
          value={bulkJson}
          onChange={(event) => setBulkJson(event.target.value)}
          placeholder='[{"type":"SINGLE_CHOICE","status":"DRAFT","contentJson":{"stem":[{"type":"text","content":"..."}],"type":"SINGLE_CHOICE","payload":{"options":[]},"_version":2}}]'
        />
        {(bulkError || getErrorMessage(bulkCreateMutation.error)) && (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {bulkError ?? getErrorMessage(bulkCreateMutation.error)}
          </p>
        )}
      </section>
    </div>
  );
}

function QuestionEditor({
  draft,
  setDraft,
  title,
}: {
  draft: QuestionDraft;
  setDraft: Dispatch<SetStateAction<QuestionDraft>>;
  title: string;
}) {
  const patch = (value: Partial<QuestionDraft>) => setDraft((current) => ({ ...current, ...value }));

  return (
    <div className="mt-5 space-y-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary-600" />
        <h3 className="font-semibold text-neutral-900">{title}</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type">
          <select className="input" value={draft.type} onChange={(event) => patch({ type: event.target.value as QuestionType })}>
            {QUESTION_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Level">
          <select className="input" value={draft.level} onChange={(event) => patch({ level: event.target.value as CognitiveLevel })}>
            {LEVELS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Time">
          <input className="input" type="number" min={10} max={3600} value={draft.expectedTimeSecs} onChange={(event) => patch({ expectedTimeSecs: Number(event.target.value) })} />
        </Field>
        <Field label="IRT a" title="Discrimination">
          <input className="input" type="number" min={0} max={3} step={0.1} value={draft.irtParams.a} onChange={(event) => patch({ irtParams: { ...draft.irtParams, a: Number(event.target.value) } })} />
        </Field>
        <Field label="IRT b" title="Difficulty">
          <input className="input" type="number" min={-3} max={3} step={0.1} value={draft.irtParams.b} onChange={(event) => patch({ irtParams: { ...draft.irtParams, b: Number(event.target.value) } })} />
        </Field>
        <Field label="IRT c" title="Guessing">
          <input className="input" type="number" min={0} max={0.35} step={0.01} value={draft.irtParams.c} onChange={(event) => patch({ irtParams: { ...draft.irtParams, c: Number(event.target.value) } })} />
        </Field>
      </div>

      <Field label="Stem">
        <textarea className="input min-h-28 resize-y" value={draft.stem} onChange={(event) => patch({ stem: event.target.value })} />
      </Field>
      <Field label="Solution">
        <textarea className="input min-h-20 resize-y" value={draft.solution} onChange={(event) => patch({ solution: event.target.value })} />
      </Field>

      <PayloadEditor draft={draft} setDraft={setDraft} />
    </div>
  );
}

function PayloadEditor({ draft, setDraft }: { draft: QuestionDraft; setDraft: Dispatch<SetStateAction<QuestionDraft>> }) {
  const patch = (value: Partial<QuestionDraft>) => setDraft((current) => ({ ...current, ...value }));

  if (draft.type === 'SINGLE_CHOICE' || draft.type === 'MULTIPLE_CHOICE') {
    return (
      <div className="space-y-3 border-t border-neutral-200 pt-5">
        <SectionHeader
          title="Options"
          onAdd={() => patch({ choices: [...draft.choices, { id: String.fromCharCode(65 + draft.choices.length), content: '', isCorrect: false }] })}
          disabled={draft.choices.length >= 5}
        />
        {draft.choices.map((option, index) => (
          <div key={option.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_7rem_2.25rem]">
            <input className="input" value={option.id} disabled />
            <input className="input" value={option.content} onChange={(event) => updateChoice(index, { content: event.target.value })} />
            <label className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm text-neutral-700">
              <input
                type={draft.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                checked={option.isCorrect}
                onChange={(event) => {
                  if (draft.type === 'SINGLE_CHOICE') {
                    patch({ choices: draft.choices.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })) });
                  } else {
                    updateChoice(index, { isCorrect: event.target.checked });
                  }
                }}
              />
              Correct
            </label>
            <IconButton disabled={draft.choices.length <= 2} label="Remove option" onClick={() => patch({ choices: draft.choices.filter((_, itemIndex) => itemIndex !== index) })} />
          </div>
        ))}
      </div>
    );
  }

  if (draft.type === 'TRUE_FALSE_MATRIX') {
    return (
      <div className="space-y-3 border-t border-neutral-200 pt-5">
        <SectionHeader title="Statements" onAdd={() => patch({ statements: [...draft.statements, { id: `S${draft.statements.length + 1}`, content: '', isTrue: true }] })} />
        {draft.statements.map((statement, index) => (
          <div key={statement.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_8rem_2.25rem]">
            <input className="input" value={statement.id} disabled />
            <input className="input" value={statement.content} onChange={(event) => updateStatement(index, { content: event.target.value })} />
            <select className="input" value={String(statement.isTrue)} onChange={(event) => updateStatement(index, { isTrue: event.target.value === 'true' })}>
              <option value="true">Đúng</option>
              <option value="false">Sai</option>
            </select>
            <IconButton disabled={draft.statements.length <= 1} label="Remove statement" onClick={() => patch({ statements: draft.statements.filter((_, itemIndex) => itemIndex !== index) })} />
          </div>
        ))}
      </div>
    );
  }

  if (draft.type === 'DRAG_DROP') {
    return (
      <div className="grid gap-4 border-t border-neutral-200 pt-5 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader title="Items" onAdd={() => patch({ dragItems: [...draft.dragItems, { id: `I${draft.dragItems.length + 1}`, content: '' }] })} />
          {draft.dragItems.map((item, index) => (
            <div key={item.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_2.25rem]">
              <input className="input" value={item.id} disabled />
              <input className="input" value={item.content} onChange={(event) => updateDragItem(index, { content: event.target.value })} />
              <IconButton disabled={draft.dragItems.length <= 1} label="Remove item" onClick={() => patch({ dragItems: draft.dragItems.filter((_, itemIndex) => itemIndex !== index) })} />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <SectionHeader title="Slots" onAdd={() => patch({ dragSlots: [...draft.dragSlots, { id: `slot${draft.dragSlots.length + 1}`, label: `Slot ${draft.dragSlots.length + 1}`, correctItemId: draft.dragItems[0]?.id ?? 'I1' }] })} />
          {draft.dragSlots.map((slot, index) => (
            <div key={slot.id} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_7rem_2.25rem]">
              <input className="input" value={slot.label} onChange={(event) => updateDragSlot(index, { label: event.target.value })} />
              <select className="input" value={slot.correctItemId} onChange={(event) => updateDragSlot(index, { correctItemId: event.target.value })}>
                {draft.dragItems.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
              </select>
              <IconButton disabled={draft.dragSlots.length <= 1} label="Remove slot" onClick={() => patch({ dragSlots: draft.dragSlots.filter((_, itemIndex) => itemIndex !== index) })} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-neutral-200 pt-5">
      <SectionHeader
        title="Blanks"
        addLabel="Add blank"
        onAdd={() => {
          const nextId = `B${draft.fillBlanks.length + 1}`;
          patch({
            fillBlanks: [...draft.fillBlanks, { id: nextId, correctValue: 0, unit: '' }],
            stem: `${draft.stem}${draft.stem.endsWith(' ') || draft.stem.length === 0 ? '' : ' '}{{${nextId}}}`,
          });
        }}
      />
      {draft.fillBlanks.map((blank, index) => (
        <div key={blank.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_8rem_8rem_2.25rem]">
          <input className="input" value={blank.id} disabled />
          <input className="input" type="number" value={blank.correctValue} onChange={(event) => updateBlank(index, { correctValue: Number(event.target.value) })} />
          <input className="input" value={blank.unit} onChange={(event) => updateBlank(index, { unit: event.target.value })} />
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => patch({ stem: `${draft.stem}${draft.stem.endsWith(' ') || draft.stem.length === 0 ? '' : ' '}{{${blank.id}}}` })}>Insert</button>
          <IconButton disabled={draft.fillBlanks.length <= 1} label="Remove blank" onClick={() => patch({ fillBlanks: draft.fillBlanks.filter((_, itemIndex) => itemIndex !== index) })} />
        </div>
      ))}
    </div>
  );

  function updateChoice(index: number, value: Partial<ChoiceOptionState>) {
    patch({ choices: draft.choices.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });
  }
  function updateStatement(index: number, value: Partial<StatementState>) {
    patch({ statements: draft.statements.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });
  }
  function updateDragItem(index: number, value: Partial<DragItemState>) {
    patch({ dragItems: draft.dragItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });
  }
  function updateDragSlot(index: number, value: Partial<DragSlotState>) {
    patch({ dragSlots: draft.dragSlots.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });
  }
  function updateBlank(index: number, value: Partial<FillBlankState>) {
    patch({ fillBlanks: draft.fillBlanks.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });
  }
}

function Field({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <label className="block" title={title}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function SectionHeader({ title, onAdd, addLabel = 'Add', disabled }: { title: string; onAdd: () => void; addLabel?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      <button className="btn btn-secondary btn-sm" type="button" disabled={disabled} onClick={onAdd}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

function IconButton({ disabled, label, onClick }: { disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button className="btn btn-ghost btn-sm" type="button" disabled={disabled} onClick={onClick} aria-label={label}>
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function TagPicker({ title, tags, selectedIds, onChange }: { title: string; tags: TagNode[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-neutral-200 p-3 md:grid-cols-2">
        {tags.map((tag) => (
          <label key={tag.id} className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={selectedIds.includes(tag.id)}
              onChange={(event) => {
                if (event.target.checked) onChange([...selectedIds, tag.id]);
                else onChange(selectedIds.filter((id) => id !== tag.id));
              }}
            />
            <span style={{ paddingLeft: `${tag.depth * 0.75}rem` }}>{tag.name}</span>
          </label>
        ))}
        {tags.length === 0 && <p className="text-sm text-neutral-500">Chưa có taxonomy.</p>}
      </div>
    </div>
  );
}

function SubmitBar({ error, isPending, onSubmit, submitLabel }: { error: string | null; isPending: boolean; onSubmit: () => void; submitLabel: string }) {
  return (
    <div className="mt-5 border-t border-neutral-200 pt-5">
      {error && <p className="mb-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
      <div className="flex justify-end">
        <button className="btn btn-primary btn-md" type="button" disabled={isPending} onClick={onSubmit}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function QuestionPreview({ draft, title = 'Question' }: { draft: QuestionDraft; title?: string }) {
  const content = buildQuestionContent(draft);
  return (
    <div className="space-y-4">
      <PreviewBlock title={`${title} stem`} nodes={content.stem} />
      <PreviewBlock title="Payload" nodes={payloadPreview(draft)} />
      <PreviewBlock title="Solution" nodes={content.solution ?? []} mutedText="Chưa có lời giải." />
    </div>
  );
}

function PreviewBlock({ title, nodes, mutedText }: { title: string; nodes: RichTextNode[]; mutedText?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {nodes.length > 0 ? (
        <div className="text-sm leading-7 text-neutral-800"><RichTextPreview nodes={nodes} /></div>
      ) : (
        <p className="text-sm text-neutral-400">{mutedText ?? 'Chưa có nội dung.'}</p>
      )}
    </div>
  );
}

function RichTextPreview({ nodes }: { nodes: RichTextNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const key = `${node.type}-${index}`;
        if (node.type === 'latex') return <InlineMath key={key} math={node.content ?? ''} />;
        if (node.type === 'latex_block') return <BlockMath key={key} math={node.content ?? ''} />;
        if (node.type === 'bold') return <strong key={key}>{node.content}</strong>;
        if (node.type === 'italic') return <em key={key}>{node.content}</em>;
        if (node.type === 'break') return <br key={key} />;
        if (node.type === 'blank') return <span key={key} className="mx-1 inline-flex min-w-14 rounded border border-primary-300 bg-primary-50 px-2 py-0.5 text-primary-700">{node.blankId}</span>;
        if (node.type === 'image') return <img key={key} src={node.url} alt={node.alt ?? ''} className="my-2 max-h-52 rounded" />;
        return <span key={key}>{node.content}</span>;
      })}
    </>
  );
}

function QuestionList({ questions }: { questions: AdminQuestion[] }) {
  return (
    <div className="divide-y divide-neutral-100">
      {questions.map((question) => (
        <div key={question.id} className="p-4">
          <p className="font-medium text-neutral-900">{summarizeRichText(question.contentJson.stem)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge badge-neutral">{question.type}</span>
            <span className="badge badge-primary">{question.level}</span>
            {question.tags.map(({ tag }) => <span key={tag.id} className="badge badge-neutral">{tag.name}</span>)}
          </div>
        </div>
      ))}
      {questions.length === 0 && <p className="p-8 text-center text-sm text-neutral-500">Chưa có câu hỏi.</p>}
    </div>
  );
}

function BundleList({ bundles }: { bundles: PassageBundle[] }) {
  return (
    <div className="divide-y divide-neutral-100">
      {bundles.map((bundle) => (
        <div key={bundle.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-neutral-900">{bundle.title}</p>
            <span className="badge badge-primary">{bundle.sectionType}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge badge-neutral">{bundle.questions.length} questions</span>
            <span className="badge badge-neutral">{bundle.status}</span>
            {bundle.tags?.map(({ tag }) => <span key={tag.id} className="badge badge-neutral">{tag.name}</span>)}
          </div>
        </div>
      ))}
      {bundles.length === 0 && <p className="p-8 text-center text-sm text-neutral-500">Chưa có bundle.</p>}
    </div>
  );
}

function createQuestionDraft(): QuestionDraft {
  return {
    type: 'SINGLE_CHOICE',
    level: 'APPLICATION',
    expectedTimeSecs: 90,
    stem: '',
    solution: '',
    irtParams: { a: 1, b: 0, c: 0.25 },
    choices: [
      { id: 'A', content: '', isCorrect: true },
      { id: 'B', content: '', isCorrect: false },
      { id: 'C', content: '', isCorrect: false },
      { id: 'D', content: '', isCorrect: false },
    ],
    statements: [
      { id: 'S1', content: '', isTrue: true },
      { id: 'S2', content: '', isTrue: false },
    ],
    dragItems: [
      { id: 'I1', content: '' },
      { id: 'I2', content: '' },
    ],
    dragSlots: [
      { id: 'slot1', label: 'Slot 1', correctItemId: 'I1' },
      { id: 'slot2', label: 'Slot 2', correctItemId: 'I2' },
    ],
    fillBlanks: [{ id: 'B1', correctValue: 0, unit: '' }],
  };
}

function createBundleDrafts(section: Exclude<SectionMode, 'MATH'>) {
  return Array.from({ length: BUNDLE_COUNTS[section] }, () => createQuestionDraft());
}

function buildQuestionContent(draft: QuestionDraft): CreateQuestionPayload['contentJson'] {
  const content: CreateQuestionPayload['contentJson'] = {
    stem: parseRichText(draft.stem, draft.type === 'FILL_NUMBER'),
    type: draft.type,
    payload: {},
    _version: 2,
  };
  if (draft.solution.trim()) content.solution = parseRichText(draft.solution);

  if (draft.type === 'SINGLE_CHOICE' || draft.type === 'MULTIPLE_CHOICE') {
    content.payload = {
      options: draft.choices.map((option) => ({
        id: option.id,
        content: parseRichText(option.content || option.id),
        isCorrect: option.isCorrect,
      })),
    };
  } else if (draft.type === 'TRUE_FALSE_MATRIX') {
    content.payload = {
      statements: draft.statements.map((statement) => ({
        id: statement.id,
        content: parseRichText(statement.content || statement.id),
        isTrue: statement.isTrue,
      })),
    };
  } else if (draft.type === 'DRAG_DROP') {
    content.payload = {
      items: draft.dragItems.map((item) => ({ id: item.id, content: parseRichText(item.content || item.id) })),
      slots: draft.dragSlots.map((slot) => ({ id: slot.id, label: parseRichText(slot.label || slot.id), correctItemId: slot.correctItemId })),
    };
  } else {
    content.payload = {
      blanks: draft.fillBlanks.map((blank) => ({
        id: blank.id,
        correctValue: blank.correctValue,
        ...(blank.unit ? { unit: blank.unit } : {}),
      })),
    };
  }

  return content;
}

function validateQuestionDraft(content: CreateQuestionPayload['contentJson']) {
  if (content.stem.length === 0) return 'Stem không được để trống.';
  if (content.type === 'SINGLE_CHOICE' || content.type === 'MULTIPLE_CHOICE') {
    const options = (content.payload.options as Array<{ isCorrect: boolean; content: RichTextNode[] }> | undefined) ?? [];
    const correctCount = options.filter((option) => option.isCorrect).length;
    if (options.length < 2) return 'Choice question cần ít nhất 2 options.';
    if (options.some((option) => option.content.length === 0)) return 'Option content không được để trống.';
    if (content.type === 'SINGLE_CHOICE' && correctCount !== 1) return 'Single choice cần đúng 1 đáp án đúng.';
    if (content.type === 'MULTIPLE_CHOICE' && correctCount < 1) return 'Multiple choice cần ít nhất 1 đáp án đúng.';
  }
  if (content.type === 'FILL_NUMBER') {
    const blankIds = new Set(content.stem.filter((node) => node.type === 'blank').map((node) => node.blankId));
    const blanks = (content.payload.blanks as Array<{ id: string }> | undefined) ?? [];
    const missing = blanks.find((blank) => !blankIds.has(blank.id));
    if (missing) return `Stem cần chứa token {{${missing.id}}} cho blank ${missing.id}.`;
  }
  return null;
}

function payloadPreview(draft: QuestionDraft) {
  if (draft.type === 'SINGLE_CHOICE' || draft.type === 'MULTIPLE_CHOICE') {
    return draft.choices.flatMap((option) => [
      { type: 'bold', content: `${option.id}. ` } satisfies RichTextNode,
      ...parseRichText(option.content || option.id),
      { type: 'text', content: option.isCorrect ? '  ✓' : '' } satisfies RichTextNode,
      { type: 'break' } satisfies RichTextNode,
    ]);
  }
  if (draft.type === 'TRUE_FALSE_MATRIX') {
    return draft.statements.flatMap((statement) => [
      { type: 'bold', content: `${statement.id}. ` } satisfies RichTextNode,
      ...parseRichText(statement.content || statement.id),
      { type: 'text', content: `  ${statement.isTrue ? 'Đúng' : 'Sai'}` } satisfies RichTextNode,
      { type: 'break' } satisfies RichTextNode,
    ]);
  }
  if (draft.type === 'DRAG_DROP') {
    return draft.dragSlots.flatMap((slot) => [
      { type: 'bold', content: `${slot.label}: ` } satisfies RichTextNode,
      { type: 'text', content: slot.correctItemId } satisfies RichTextNode,
      { type: 'break' } satisfies RichTextNode,
    ]);
  }
  return draft.fillBlanks.flatMap((blank) => [
    { type: 'bold', content: `${blank.id}: ` } satisfies RichTextNode,
    { type: 'text', content: `${blank.correctValue}${blank.unit ? ` ${blank.unit}` : ''}` } satisfies RichTextNode,
    { type: 'break' } satisfies RichTextNode,
  ]);
}

function parseRichText(value: string, includeBlanks = false): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  const pattern = includeBlanks ? /(\{\{[A-Za-z0-9_-]+\}\}|\$\$[^$]+\$\$|\$[^$]+\$|\n)/g : /(\$\$[^$]+\$\$|\$[^$]+\$|\n)/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: 'text', content: value.slice(cursor, index) });
    const token = match[0];
    if (token === '\n') nodes.push({ type: 'break' });
    else if (token.startsWith('{{') && token.endsWith('}}')) nodes.push({ type: 'blank', blankId: token.slice(2, -2) });
    else if (token.startsWith('$$')) nodes.push({ type: 'latex_block', content: token.slice(2, -2) });
    else nodes.push({ type: 'latex', content: token.slice(1, -1) });
    cursor = index + token.length;
  }
  if (cursor < value.length) nodes.push({ type: 'text', content: value.slice(cursor) });
  return nodes.filter((node) => node.type === 'break' || node.type === 'blank' || Boolean(node.content?.trim()));
}

function summarizeRichText(nodes: RichTextNode[]) {
  return nodes
    .map((node) => {
      if (node.type === 'latex' || node.type === 'latex_block') return `$${node.content ?? ''}$`;
      if (node.type === 'blank') return `[${node.blankId}]`;
      if (node.type === 'break') return ' ';
      return node.content ?? '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function flattenTags(tags: TagNode[]) {
  const result: TagNode[] = [];
  const visit = (items: TagNode[]) => {
    items.forEach((item) => {
      result.push(item);
      visit(item.children);
    });
  };
  visit(tags);
  return result;
}

function isQuestionEnvelope(value: unknown): value is { questions: unknown[] } {
  return Boolean(value && typeof value === 'object' && 'questions' in value && Array.isArray((value as { questions?: unknown }).questions));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
