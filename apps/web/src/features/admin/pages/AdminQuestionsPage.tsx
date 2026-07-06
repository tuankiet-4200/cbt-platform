import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Eye,
  FilePlus2,
  Filter,
  Loader2,
  Plus,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import { cn } from '@/lib/utils';
import {
  bulkUpdateQuestionStatus,
  bulkCreateQuestions,
  createQuestion,
  listQuestions,
  listTags,
  type AdminQuestion,
  type CognitiveLevel,
  type CreateQuestionPayload,
  type QuestionStatus,
  type QuestionType,
  type RichTextNode,
  type TagNode,
} from '../api/questionBank.api';

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

const defaultChoices: ChoiceOptionState[] = [
  { id: 'A', content: '', isCorrect: true },
  { id: 'B', content: '', isCorrect: false },
  { id: 'C', content: '', isCorrect: false },
  { id: 'D', content: '', isCorrect: false },
];

export default function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    type: '' | QuestionType;
    level: '' | CognitiveLevel;
    status: '' | QuestionStatus;
    tagId: string[];
  }>({ type: '', level: '', status: '', tagId: [] });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [type, setType] = useState<QuestionType>('SINGLE_CHOICE');
  const [level, setLevel] = useState<CognitiveLevel>('APPLICATION');
  const [status, setStatus] = useState<QuestionStatus>('DRAFT');
  const [expectedTimeSecs, setExpectedTimeSecs] = useState(90);
  const [stem, setStem] = useState('');
  const [solution, setSolution] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [irtParams, setIrtParams] = useState({ a: 1, b: 0, c: 0.25 });
  const [choices, setChoices] = useState<ChoiceOptionState[]>(defaultChoices);
  const [statements, setStatements] = useState<StatementState[]>([
    { id: 'S1', content: '', isTrue: true },
    { id: 'S2', content: '', isTrue: false },
    { id: 'S3', content: '', isTrue: true },
  ]);
  const [dragItems, setDragItems] = useState<DragItemState[]>([
    { id: 'I1', content: '' },
    { id: 'I2', content: '' },
    { id: 'I3', content: '' },
  ]);
  const [dragSlots, setDragSlots] = useState<DragSlotState[]>([
    { id: 'slot1', label: 'Bước 1', correctItemId: 'I1' },
    { id: 'slot2', label: 'Bước 2', correctItemId: 'I2' },
    { id: 'slot3', label: 'Bước 3', correctItemId: 'I3' },
  ]);
  const [fillBlanks, setFillBlanks] = useState<FillBlankState[]>([
    { id: 'B1', correctValue: 0, unit: '' },
  ]);
  const [reviewNote, setReviewNote] = useState('');
  const [bulkJson, setBulkJson] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const tagsQuery = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: listTags,
  });

  const questionsQuery = useQuery({
    queryKey: ['admin', 'questions', page, filters],
    queryFn: () =>
      listQuestions({
        page,
        limit: 10,
        type: filters.type || undefined,
        level: filters.level || undefined,
        status: filters.status || undefined,
        tagId: filters.tagId,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const flatTags = useMemo(() => flattenTags(tagsQuery.data ?? []), [tagsQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateQuestionPayload) => createQuestion(payload),
    onSuccess: () => {
      setStem('');
      setSolution('');
      setReviewNote('');
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (nextStatus: QuestionStatus) =>
      bulkUpdateQuestionStatus(selectedIds, { status: nextStatus, reviewNote }),
    onSuccess: () => {
      setSelectedIds([]);
      setReviewNote('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: CreateQuestionPayload[]) => bulkCreateQuestions(payload),
    onSuccess: () => {
      setBulkJson('');
      setBulkError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'questions'] });
    },
  });

  const previewContent = useMemo(
    () => ({
      stem: parseRichText(stem),
      solution: solution.trim() ? parseRichText(solution) : [],
    }),
    [stem, solution],
  );

  const handleSubmit = () => {
    setFormError(null);
    const contentJson = buildQuestionContent({
      type,
      stem,
      solution,
      choices,
      statements,
      dragItems,
      dragSlots,
      fillBlanks,
    });
    const validationError = validateQuestionDraft(contentJson);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    createMutation.mutate({
      type,
      status,
      level,
      expectedTimeSecs,
      irtParams,
      tagIds: selectedTagIds,
      contentJson,
    });
  };

  const handleBulkImport = () => {
    setBulkError(null);
    try {
      const parsed = JSON.parse(bulkJson) as unknown;
      if (!Array.isArray(parsed)) {
        setBulkError('Bulk JSON phải là một mảng question payload.');
        return;
      }
      bulkCreateMutation.mutate(parsed as CreateQuestionPayload[]);
    } catch {
      setBulkError('JSON không hợp lệ.');
    }
  };

  const questions = questionsQuery.data?.data ?? [];
  const meta = questionsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Database className="h-4 w-4" />
            Admin Question Bank
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quản lý câu hỏi</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Nhập nhanh câu hỏi, gắn taxonomy, review và xuất bản vào question bank.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-neutral-200 bg-white p-2">
          <Metric label="Total" value={meta?.total ?? 0} />
          <Metric label="Selected" value={selectedIds.length} />
          <Metric label="Page" value={meta ? `${meta.page}/${Math.max(meta.totalPages, 1)}` : '1/1'} />
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(26rem,.95fr)]">
        <div className="card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Tạo câu hỏi</h2>
              <p className="mt-1 text-sm text-neutral-500">Payload động theo từng loại câu hỏi.</p>
            </div>
            <FilePlus2 className="h-5 w-5 text-primary-600" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <select className="input" value={type} onChange={(event) => setType(event.target.value as QuestionType)}>
                {QUESTION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className="input"
                value={status}
                onChange={(event) => setStatus(event.target.value as QuestionStatus)}
              >
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Level">
              <select
                className="input"
                value={level}
                onChange={(event) => setLevel(event.target.value as CognitiveLevel)}
              >
                {LEVELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expected time">
              <input
                className="input"
                type="number"
                min={10}
                max={3600}
                value={expectedTimeSecs}
                onChange={(event) => setExpectedTimeSecs(Number(event.target.value))}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="IRT a" title="Discrimination">
              <input
                className="input"
                type="number"
                min={0}
                max={3}
                step={0.1}
                value={irtParams.a}
                onChange={(event) => setIrtParams((value) => ({ ...value, a: Number(event.target.value) }))}
              />
            </Field>
            <Field label="IRT b" title="Difficulty">
              <input
                className="input"
                type="number"
                min={-3}
                max={3}
                step={0.1}
                value={irtParams.b}
                onChange={(event) => setIrtParams((value) => ({ ...value, b: Number(event.target.value) }))}
              />
            </Field>
            <Field label="IRT c" title="Guessing">
              <input
                className="input"
                type="number"
                min={0}
                max={0.35}
                step={0.01}
                value={irtParams.c}
                onChange={(event) => setIrtParams((value) => ({ ...value, c: Number(event.target.value) }))}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Stem">
              <textarea className="input min-h-28 resize-y" value={stem} onChange={(event) => setStem(event.target.value)} />
            </Field>
            <Field label="Solution">
              <textarea
                className="input min-h-20 resize-y"
                value={solution}
                onChange={(event) => setSolution(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <PayloadEditor
              type={type}
              stem={stem}
              setStem={setStem}
              choices={choices}
              setChoices={setChoices}
              statements={statements}
              setStatements={setStatements}
              dragItems={dragItems}
              setDragItems={setDragItems}
              dragSlots={dragSlots}
              setDragSlots={setDragSlots}
              fillBlanks={fillBlanks}
              setFillBlanks={setFillBlanks}
            />
          </div>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <TagPicker tags={tagsQuery.data ?? []} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
          </div>

          {(formError || createMutation.error) && (
            <p className="mt-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {formError ?? getErrorMessage(createMutation.error)}
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button
              className="btn btn-primary btn-md"
              onClick={handleSubmit}
              disabled={createMutation.isPending || stem.trim().length === 0}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Lưu câu hỏi
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-5 flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-neutral-900">Preview</h2>
          </div>
          <div className="space-y-5">
            <PreviewBlock title="Stem" nodes={previewContent.stem} />
            <PreviewBlock title="Payload" nodes={payloadPreview(type, { choices, statements, dragItems, dragSlots, fillBlanks })} />
            <PreviewBlock title="Solution" nodes={previewContent.solution} mutedText="Chưa có lời giải." />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Upload className="h-4 w-4" />
              Bulk JSON Import
            </div>
            <h2 className="mt-1 text-base font-semibold text-neutral-900">Nhập hàng loạt câu hỏi</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Dán mảng JSON theo contract `CreateQuestionPayload[]`. Backend validate toàn bộ trong transaction.
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => setBulkJson(JSON.stringify([buildQuestionContent({
              type,
              stem: stem || 'Câu hỏi mẫu $x^2$',
              solution,
              choices,
              statements,
              dragItems,
              dragSlots,
              fillBlanks,
            })].map((contentJson) => ({
              type: contentJson.type,
              status: 'DRAFT',
              level,
              expectedTimeSecs,
              irtParams,
              tagIds: selectedTagIds,
              contentJson,
            })), null, 2))}
          >
            <Copy className="h-4 w-4" />
            Fill sample
          </button>
        </div>
        <textarea
          className="input mt-4 min-h-52 resize-y font-mono text-xs"
          value={bulkJson}
          onChange={(event) => setBulkJson(event.target.value)}
          placeholder='[{"type":"SINGLE_CHOICE","contentJson":{...}}]'
        />
        {(bulkError || bulkCreateMutation.error) && (
          <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {bulkError ?? getErrorMessage(bulkCreateMutation.error)}
          </p>
        )}
        {bulkCreateMutation.data && (
          <p className="mt-3 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
            Đã tạo {bulkCreateMutation.data.createdCount} câu hỏi.
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button
            className="btn btn-primary btn-md"
            disabled={bulkCreateMutation.isPending || bulkJson.trim().length === 0}
            onClick={handleBulkImport}
          >
            {bulkCreateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import JSON
          </button>
        </div>
      </section>

      <section className="card">
        <div className="border-b border-neutral-200 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
                <Filter className="h-4 w-4" />
                Filters
              </div>
              <h2 className="mt-1 text-base font-semibold text-neutral-900">Danh sách câu hỏi</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-4 xl:w-[44rem]">
              <select className="input" value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
                <option value="">All types</option>
                {QUESTION_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select className="input" value={filters.level} onChange={(event) => updateFilter('level', event.target.value)}>
                <option value="">All levels</option>
                {LEVELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select className="input" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option value="">All status</option>
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filters.tagId[0] ?? ''}
                onChange={(event) => {
                  setPage(1);
                  setFilters((value) => ({ ...value, tagId: event.target.value ? [event.target.value] : [] }));
                }}
              >
                <option value="">All tags</option>
                {flatTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {'- '.repeat(tag.depth)}
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Search className="h-4 w-4" />
              {questionsQuery.isFetching ? 'Đang tải dữ liệu...' : `${meta?.total ?? 0} câu hỏi`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input w-72"
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Review note"
              />
              <button
                className="btn btn-secondary btn-sm"
                disabled={selectedIds.length === 0 || bulkStatusMutation.isPending}
                onClick={() => bulkStatusMutation.mutate('PUBLISHED')}
              >
                <Check className="h-4 w-4" />
                Publish
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={selectedIds.length === 0 || bulkStatusMutation.isPending}
                onClick={() => bulkStatusMutation.mutate('ARCHIVED')}
              >
                <Archive className="h-4 w-4" />
                Archive
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-12 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={questions.length > 0 && questions.every((question) => selectedIds.includes(question.id))}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((value) => Array.from(new Set([...value, ...questions.map((question) => question.id)])));
                      } else {
                        setSelectedIds((value) => value.filter((id) => !questions.some((question) => question.id === id)));
                      }
                    }}
                  />
                </th>
                <th className="px-5 py-3">Question</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Level</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Tags</th>
                <th className="px-5 py-3">Author</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {questions.map((question) => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  selected={selectedIds.includes(question.id)}
                  onToggle={(checked) =>
                    setSelectedIds((value) =>
                      checked ? [...value, question.id] : value.filter((id) => id !== question.id),
                    )
                  }
                />
              ))}
              {!questionsQuery.isLoading && questions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-neutral-500">
                    Chưa có câu hỏi phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-4">
          <button
            className="btn btn-secondary btn-sm"
            disabled={!meta?.hasPrevPage}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <span className="text-sm text-neutral-500">
            Page {meta?.page ?? page} of {Math.max(meta?.totalPages ?? 1, 1)}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!meta?.hasNextPage}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );

  function updateFilter(key: 'type' | 'level' | 'status', value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-24 rounded-md bg-neutral-50 px-3 py-2">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-neutral-900">{value}</p>
    </div>
  );
}

function Field({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <label className="block" title={title}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

interface PayloadEditorProps {
  type: QuestionType;
  stem: string;
  setStem: Dispatch<SetStateAction<string>>;
  choices: ChoiceOptionState[];
  setChoices: Dispatch<SetStateAction<ChoiceOptionState[]>>;
  statements: StatementState[];
  setStatements: Dispatch<SetStateAction<StatementState[]>>;
  dragItems: DragItemState[];
  setDragItems: Dispatch<SetStateAction<DragItemState[]>>;
  dragSlots: DragSlotState[];
  setDragSlots: Dispatch<SetStateAction<DragSlotState[]>>;
  fillBlanks: FillBlankState[];
  setFillBlanks: Dispatch<SetStateAction<FillBlankState[]>>;
}

function PayloadEditor(props: PayloadEditorProps) {
  if (props.type === 'SINGLE_CHOICE' || props.type === 'MULTIPLE_CHOICE') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel text="Options" />
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            disabled={props.choices.length >= 5}
            onClick={() =>
              props.setChoices((items) => [
                ...items,
                { id: String.fromCharCode(65 + items.length), content: '', isCorrect: false },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {props.choices.map((option, index) => (
          <div key={option.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_7rem_2.25rem]">
            <input className="input" value={option.id} disabled />
            <input
              className="input"
              value={option.content}
              onChange={(event) => updateChoice(index, { content: event.target.value })}
            />
            <label className="flex items-center justify-center gap-2 rounded-lg border border-neutral-200 text-sm text-neutral-700">
              <input
                type={props.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                checked={option.isCorrect}
                onChange={(event) => {
                  if (props.type === 'SINGLE_CHOICE') {
                    props.setChoices((items) => items.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })));
                  } else {
                    updateChoice(index, { isCorrect: event.target.checked });
                  }
                }}
              />
              Correct
            </label>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={props.choices.length <= 2}
              onClick={() => props.setChoices((items) => items.filter((_, itemIndex) => itemIndex !== index))}
              aria-label="Remove option"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (props.type === 'TRUE_FALSE_MATRIX') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel text="Statements" />
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() =>
              props.setStatements((items) => [
                ...items,
                { id: `S${items.length + 1}`, content: '', isTrue: true },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {props.statements.map((statement, index) => (
          <div key={statement.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_8rem_2.25rem]">
            <input className="input" value={statement.id} disabled />
            <input
              className="input"
              value={statement.content}
              onChange={(event) =>
                props.setStatements((items) =>
                  items.map((item, itemIndex) => (itemIndex === index ? { ...item, content: event.target.value } : item)),
                )
              }
            />
            <select
              className="input"
              value={String(statement.isTrue)}
              onChange={(event) =>
                props.setStatements((items) =>
                  items.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, isTrue: event.target.value === 'true' } : item,
                  ),
                )
              }
            >
              <option value="true">Đúng</option>
              <option value="false">Sai</option>
            </select>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              disabled={props.statements.length <= 1}
              onClick={() => props.setStatements((items) => items.filter((_, itemIndex) => itemIndex !== index))}
              aria-label="Remove statement"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (props.type === 'DRAG_DROP') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel text="Items" />
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() => props.setDragItems((items) => [...items, { id: `I${items.length + 1}`, content: '' }])}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
          {props.dragItems.map((item, index) => (
            <div key={item.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_2.25rem]">
              <input className="input" value={item.id} disabled />
              <input
                className="input"
                value={item.content}
                onChange={(event) =>
                  props.setDragItems((items) =>
                    items.map((entry, itemIndex) => (itemIndex === index ? { ...entry, content: event.target.value } : entry)),
                  )
                }
              />
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={props.dragItems.length <= 1}
                onClick={() => props.setDragItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                aria-label="Remove drag item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel text="Slots" />
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() =>
                props.setDragSlots((items) => [
                  ...items,
                  { id: `slot${items.length + 1}`, label: `Slot ${items.length + 1}`, correctItemId: props.dragItems[0]?.id ?? 'I1' },
                ])
              }
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
          {props.dragSlots.map((slot, index) => (
            <div key={slot.id} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_7rem_2.25rem]">
              <input
                className="input"
                value={slot.label}
                onChange={(event) =>
                  props.setDragSlots((items) =>
                    items.map((entry, itemIndex) => (itemIndex === index ? { ...entry, label: event.target.value } : entry)),
                  )
                }
              />
              <select
                className="input"
                value={slot.correctItemId}
                onChange={(event) =>
                  props.setDragSlots((items) =>
                    items.map((entry, itemIndex) =>
                      itemIndex === index ? { ...entry, correctItemId: event.target.value } : entry,
                    ),
                  )
                }
              >
                {props.dragItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={props.dragSlots.length <= 1}
                onClick={() => props.setDragSlots((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                aria-label="Remove drag slot"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel text="Blanks" />
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            const nextId = `B${props.fillBlanks.length + 1}`;
            props.setFillBlanks((items) => [...items, { id: nextId, correctValue: 0, unit: '' }]);
            props.setStem((value) => `${value}${value.endsWith(' ') || value.length === 0 ? '' : ' '}{{${nextId}}}`);
          }}
        >
          <Plus className="h-4 w-4" />
          Add blank
        </button>
      </div>
      {props.fillBlanks.map((blank, index) => (
        <div key={blank.id} className="grid gap-2 md:grid-cols-[4rem_minmax(0,1fr)_8rem_8rem_2.25rem]">
          <input className="input" value={blank.id} disabled />
          <input
            className="input"
            type="number"
            value={blank.correctValue}
            onChange={(event) =>
              props.setFillBlanks((items) =>
                items.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, correctValue: Number(event.target.value) } : item,
                ),
              )
            }
          />
          <input
            className="input"
            value={blank.unit}
            onChange={(event) =>
              props.setFillBlanks((items) =>
                items.map((item, itemIndex) => (itemIndex === index ? { ...item, unit: event.target.value } : item)),
              )
            }
          />
          <button
            className="btn btn-secondary btn-sm"
            type="button"
            onClick={() => props.setStem((value) => `${value}${value.endsWith(' ') || value.length === 0 ? '' : ' '}{{${blank.id}}}`)}
          >
            Insert
          </button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            disabled={props.fillBlanks.length <= 1}
            onClick={() => props.setFillBlanks((items) => items.filter((_, itemIndex) => itemIndex !== index))}
            aria-label="Remove blank"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );

  function updateChoice(index: number, patch: Partial<ChoiceOptionState>) {
    props.setChoices((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
}

function SectionLabel({ text }: { text: string }) {
  return <h3 className="text-sm font-semibold text-neutral-800">{text}</h3>;
}

function TagPicker({
  tags,
  selectedIds,
  onChange,
}: {
  tags: TagNode[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const flatTags = useMemo(() => flattenTags(tags), [tags]);

  return (
    <div>
      <SectionLabel text="Tags" />
      <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto rounded-lg border border-neutral-200 p-3 md:grid-cols-2">
        {flatTags.map((tag) => (
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
        {flatTags.length === 0 && <p className="text-sm text-neutral-500">Chưa có taxonomy.</p>}
      </div>
    </div>
  );
}

function PreviewBlock({ title, nodes, mutedText }: { title: string; nodes: RichTextNode[]; mutedText?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {nodes.length > 0 ? (
        <div className="text-sm leading-7 text-neutral-800">
          <RichTextPreview nodes={nodes} />
        </div>
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
        if (node.type === 'blank') {
          return (
            <span key={key} className="mx-1 inline-flex min-w-14 rounded border border-primary-300 bg-primary-50 px-2 py-0.5 text-primary-700">
              {node.blankId}
            </span>
          );
        }
        if (node.type === 'image') return <img key={key} src={node.url} alt={node.alt ?? ''} className="my-2 max-h-52 rounded" />;
        return <span key={key}>{node.content}</span>;
      })}
    </>
  );
}

function QuestionRow({
  question,
  selected,
  onToggle,
}: {
  question: AdminQuestion;
  selected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const stemText = summarizeRichText(question.contentJson.stem);

  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-5 py-4 align-top">
        <input type="checkbox" checked={selected} onChange={(event) => onToggle(event.target.checked)} />
      </td>
      <td className="max-w-xl px-5 py-4 align-top">
        <p className="line-clamp-2 font-medium text-neutral-900">{stemText}</p>
        <p className="mt-1 font-mono text-xs text-neutral-400">{question.id.slice(0, 8)}</p>
      </td>
      <td className="px-5 py-4 align-top">
        <span className="badge badge-neutral">{question.type}</span>
      </td>
      <td className="px-5 py-4 align-top text-neutral-600">{question.level}</td>
      <td className="px-5 py-4 align-top">
        <span className={cn('badge', statusBadgeClass(question.status))}>{question.status}</span>
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex max-w-64 flex-wrap gap-1">
          {question.tags.map(({ tag }) => (
            <span key={tag.id} className="badge badge-primary">
              {tag.name}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-4 align-top text-neutral-600">{question.author.displayName}</td>
    </tr>
  );
}

function buildQuestionContent(input: {
  type: QuestionType;
  stem: string;
  solution: string;
  choices: ChoiceOptionState[];
  statements: StatementState[];
  dragItems: DragItemState[];
  dragSlots: DragSlotState[];
  fillBlanks: FillBlankState[];
}) {
  const content: CreateQuestionPayload['contentJson'] = {
    stem: parseRichText(input.stem, input.type === 'FILL_NUMBER'),
    type: input.type,
    payload: {},
    _version: 2,
  };

  if (input.solution.trim()) content.solution = parseRichText(input.solution);

  if (input.type === 'SINGLE_CHOICE' || input.type === 'MULTIPLE_CHOICE') {
    content.payload = {
      options: input.choices.map((option) => ({
        id: option.id,
        content: parseRichText(option.content || option.id),
        isCorrect: option.isCorrect,
      })),
    };
  }

  if (input.type === 'TRUE_FALSE_MATRIX') {
    content.payload = {
      statements: input.statements.map((statement) => ({
        id: statement.id,
        content: parseRichText(statement.content || statement.id),
        isTrue: statement.isTrue,
      })),
    };
  }

  if (input.type === 'DRAG_DROP') {
    content.payload = {
      items: input.dragItems.map((item) => ({
        id: item.id,
        content: parseRichText(item.content || item.id),
      })),
      slots: input.dragSlots.map((slot) => ({
        id: slot.id,
        label: parseRichText(slot.label || slot.id),
        correctItemId: slot.correctItemId,
      })),
    };
  }

  if (input.type === 'FILL_NUMBER') {
    content.payload = {
      blanks: input.fillBlanks.map((blank) => ({
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

function payloadPreview(
  type: QuestionType,
  state: {
    choices: ChoiceOptionState[];
    statements: StatementState[];
    dragItems: DragItemState[];
    dragSlots: DragSlotState[];
    fillBlanks: FillBlankState[];
  },
) {
  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    return state.choices.flatMap((option) => [
      { type: 'bold', content: `${option.id}. ` } satisfies RichTextNode,
      ...parseRichText(option.content || option.id),
      { type: 'text', content: option.isCorrect ? '  ✓' : '' } satisfies RichTextNode,
      { type: 'break' } satisfies RichTextNode,
    ]);
  }

  if (type === 'TRUE_FALSE_MATRIX') {
    return state.statements.flatMap((statement) => [
      { type: 'bold', content: `${statement.id}. ` } satisfies RichTextNode,
      ...parseRichText(statement.content || statement.id),
      { type: 'text', content: `  ${statement.isTrue ? 'Đúng' : 'Sai'}` } satisfies RichTextNode,
      { type: 'break' } satisfies RichTextNode,
    ]);
  }

  if (type === 'DRAG_DROP') {
    return state.dragSlots.flatMap((slot) => [
      { type: 'bold', content: `${slot.label}: ` } satisfies RichTextNode,
      { type: 'text', content: slot.correctItemId } satisfies RichTextNode,
      { type: 'break' } satisfies RichTextNode,
    ]);
  }

  return state.fillBlanks.flatMap((blank) => [
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

function statusBadgeClass(status: QuestionStatus) {
  if (status === 'PUBLISHED') return 'badge-success';
  if (status === 'PENDING_REVIEW') return 'badge-warning';
  if (status === 'ARCHIVED') return 'badge-danger';
  return 'badge-neutral';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Không thể lưu câu hỏi.';
}
