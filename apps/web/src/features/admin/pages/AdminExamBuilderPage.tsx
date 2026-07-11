import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AlertTriangle,
  Eye,
  FileSearch,
  GripVertical,
  Layers3,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExamSectionType } from '../api/questionBank.api';
import {
  deleteExam,
  getExamBuilder,
  listReplacementCandidates,
  previewExam,
  publishExam,
  reorderMathQuestions,
  reorderPassageBundles,
  replaceMathQuestion,
  replacePassageBundle,
  updateExamSettings,
  type ExamPreview,
  type ExamPreviewBundle,
  type ExamPreviewQuestion,
} from '../api/exams.api';
import { ExamPreviewModal } from './ExamPreviewModal';

type BuilderSection = ExamSectionType;
type ReplacementTarget =
  | { section: 'MATH'; id: string; label: string }
  | { section: 'READING' | 'SCIENCE'; id: string; label: string };

const SECTIONS: Array<{ value: BuilderSection; label: string }> = [
  { value: 'MATH', label: 'Math' },
  { value: 'READING', label: 'Reading' },
  { value: 'SCIENCE', label: 'Science' },
];

export default function AdminExamBuilderPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<BuilderSection>('MATH');
  const [replacementTarget, setReplacementTarget] = useState<ReplacementTarget | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [preview, setPreview] = useState<ExamPreview | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const builderQuery = useQuery({
    queryKey: ['admin', 'exam-builder', examId],
    queryFn: () => getExamBuilder(examId!),
    enabled: Boolean(examId),
  });

  const candidatesQuery = useQuery({
    queryKey: ['admin', 'exam-builder-candidates', examId],
    queryFn: () => listReplacementCandidates(examId!),
    enabled: Boolean(examId),
  });

  const builder = builderQuery.data;
  const sectionIds = useMemo(() => getSectionIds(builder, activeSection), [activeSection, builder]);
  const hasMetadataChanges = useMemo(() => {
    if (!builder) return false;
    return titleDraft !== builder.title || descriptionDraft !== (builder.description ?? '');
  }, [builder, descriptionDraft, titleDraft]);

  useEffect(() => {
    if (!builder) return;
    setTitleDraft(builder.title);
    setDescriptionDraft(builder.description ?? '');
  }, [builder?.id]);

  const refreshBuilder = (nextBuilder: Awaited<ReturnType<typeof getExamBuilder>>) => {
    queryClient.setQueryData(['admin', 'exam-builder', examId], nextBuilder);
    queryClient.invalidateQueries({ queryKey: ['admin', 'exam-builder-candidates', examId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
  };

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => {
      if (!examId) throw new Error('Missing exam id.');
      if (activeSection === 'MATH') return reorderMathQuestions(examId, ids);
      return reorderPassageBundles(examId, { sectionType: activeSection, passageBundleIds: ids });
    },
    onSuccess: (result) => {
      refreshBuilder(result);
      setActionError(null);
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong reorder duoc section.'),
  });

  const replaceMutation = useMutation({
    mutationFn: (replacementId: string) => {
      if (!examId || !replacementTarget) throw new Error('Select an item to replace first.');
      if (replacementTarget.section === 'MATH') {
        return replaceMathQuestion(examId, {
          currentQuestionId: replacementTarget.id,
          replacementQuestionId: replacementId,
        });
      }
      return replacePassageBundle(examId, {
        sectionType: replacementTarget.section,
        currentPassageBundleId: replacementTarget.id,
        replacementPassageBundleId: replacementId,
      });
    },
    onSuccess: (result) => {
      refreshBuilder(result);
      setReplacementTarget(null);
      setCandidateSearch('');
      setActionError(null);
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong replace duoc item.'),
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam id.');
      return previewExam(examId);
    },
    onSuccess: (result) => {
      setPreview(result);
      setActionError(null);
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong preview duoc exam.'),
  });

  const metadataMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam id.');
      return updateExamSettings(examId, {
        title: titleDraft,
        description: descriptionDraft,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
      builderQuery.refetch();
      setActionError(null);
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong cap nhat metadata duoc.'),
  });

  const publishMutation = useMutation({
    mutationFn: (nextPublished: boolean) => {
      if (!examId) throw new Error('Missing exam id.');
      return publishExam(examId, nextPublished);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
      builderQuery.refetch();
      setActionError(null);
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong cap nhat trang thai publish duoc.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!examId) throw new Error('Missing exam id.');
      return deleteExam(examId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'exams'] });
      navigate('/admin/exams');
    },
    onError: (error) => setActionError(getErrorMessage(error) ?? 'Khong xoa duoc exam.'),
  });

  const confirmIfPublished = (description: string, onConfirm: () => void) => {
    if (!builder?.isPublished) {
      onConfirm();
      return;
    }
    setConfirmAction({
      title: 'Confirm published exam update',
      description,
      confirmLabel: 'Update anyway',
      onConfirm,
    });
  };

  const saveMetadata = () => {
    confirmIfPublished('Updating metadata on a published exam changes what students see in the exam library and exam details.', () => metadataMutation.mutate());
  };

  const togglePublish = () => {
    if (!builder) return;
    const nextPublished = !builder.isPublished;
    setConfirmAction({
      title: nextPublished ? 'Publish exam' : 'Unpublish exam',
      description: nextPublished
        ? 'Publishing runs validation and makes this exam available to students according to its access type.'
        : 'Unpublishing hides this exam from students and prevents new attempts while preserving existing sessions and results.',
      confirmLabel: nextPublished ? 'Publish exam' : 'Unpublish exam',
      onConfirm: () => publishMutation.mutate(nextPublished),
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionIds.indexOf(String(active.id));
    const newIndex = sectionIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextIds = arrayMove(sectionIds, oldIndex, newIndex);
    confirmIfPublished('Reordering items in a published exam can change the student-facing order and audit trail for future attempts.', () => reorderMutation.mutate(nextIds));
  };

  const candidates = useMemo(() => {
    const source = candidatesQuery.data?.[activeSection] ?? [];
    const search = candidateSearch.trim().toLowerCase();
    if (!search) return source;
    return source.filter((item) => candidateMatches(item, search));
  }, [activeSection, candidateSearch, candidatesQuery.data]);

  if (!examId) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link to="/admin/exams" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-primary-700">
            <ArrowLeft className="h-4 w-4" />
            Back to exams
          </Link>
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-primary-700">
            <Layers3 className="h-4 w-4" />
            Edit exam
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-neutral-900">{builder?.title ?? 'Exam editor'}</h1>
            {builder && (
              <span className={cn('badge', builder.isPublished ? 'badge-success' : 'badge-warning')}>
                {builder.isPublished ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-500">Edit metadata, reorder generated items, replace weak slots, and preview before publishing.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-danger btn-md"
            type="button"
            disabled={!builder || deleteMutation.isPending}
            onClick={() => setConfirmAction({
              title: 'Delete exam',
              description: 'This permanently deletes the exam shell and generated assembly. Exams with existing sessions are protected and cannot be deleted.',
              confirmLabel: 'Delete exam',
              danger: true,
              onConfirm: () => deleteMutation.mutate(),
            })}
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
          <button
            className="btn btn-primary btn-md"
            type="button"
            disabled={!builder || metadataMutation.isPending || !titleDraft.trim() || !hasMetadataChanges}
            onClick={saveMetadata}
          >
            {metadataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
          <button
            className="btn btn-secondary btn-md"
            type="button"
            disabled={!builder || publishMutation.isPending}
            onClick={togglePublish}
          >
            {publishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {builder?.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          <button className="btn btn-secondary btn-md" type="button" onClick={() => builderQuery.refetch()} disabled={builderQuery.isFetching}>
            {builderQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
          <button className="btn btn-primary btn-md" type="button" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending || !builder}>
            {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Preview
          </button>
        </div>
      </header>

      {actionError && (
        <div className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">{actionError}</div>
      )}

      <section className="card p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="label">Title</span>
            <input className="input" value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Description</span>
            <input className="input" value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} />
          </label>
          <button
            className="btn btn-primary btn-md"
            type="button"
            disabled={!builder || metadataMutation.isPending || !titleDraft.trim() || !hasMetadataChanges}
            onClick={saveMetadata}
          >
            {metadataMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save metadata
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total points" value={builder?.totalPoints ?? '-'} />
        <Metric label="Math" value={builder?.sections.MATH.questionCount ?? '-'} />
        <Metric label="Reading" value={builder?.sections.READING.questionCount ?? '-'} />
        <Metric label="Science" value={builder?.sections.SCIENCE.questionCount ?? '-'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-neutral-200 bg-white p-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.value}
                  type="button"
                  className={cn(
                    'h-9 rounded-md px-3 text-sm font-semibold transition',
                    activeSection === section.value ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100',
                  )}
                  onClick={() => {
                    setActiveSection(section.value);
                    setReplacementTarget(null);
                    setCandidateSearch('');
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <ValidationBadge ok={Boolean(builder?.validation.ok)} />
          </div>

          <div className="p-4">
            {builderQuery.isLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Dang tai builder...
              </div>
            )}

            {builder && (
              <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {activeSection === 'MATH' && builder.sections.MATH.items?.map((question) => (
                      <QuestionRow
                        key={question.id}
                        question={question}
                  disabled={reorderMutation.isPending}
                        onReplace={() => setReplacementTarget({ section: 'MATH', id: question.id, label: `M${question.order + 1}` })}
                      />
                    ))}

                    {activeSection !== 'MATH' && builder.sections[activeSection].bundles?.map((bundle) => (
                      <BundleRow
                        key={bundle.id}
                        bundle={bundle}
                        disabled={reorderMutation.isPending}
                        onReplace={() => setReplacementTarget({ section: activeSection, id: bundle.id, label: `${activeSection}-${bundle.order + 1}` })}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <FileSearch className="h-4 w-4" />
              Replacement bank
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              {replacementTarget ? `Replacing ${replacementTarget.label}` : 'Select Replace on an item to target a slot.'}
            </p>

            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                className="input pl-9"
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                placeholder="Search candidate"
              />
            </label>

            <div className="mt-4 max-h-[38rem] space-y-3 overflow-y-auto pr-1">
              {candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  disabled={!replacementTarget || replacementTarget.section !== activeSection || replaceMutation.isPending}
                  onChoose={() => confirmIfPublished('Replacing items in a published exam changes the content students will see in future attempts and can affect score comparability.', () => replaceMutation.mutate(candidate.id))}
                />
              ))}
              {!candidatesQuery.isLoading && candidates.length === 0 && (
                <p className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500">No compatible candidate found.</p>
              )}
              {candidatesQuery.isLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Dang tai candidate...
                </div>
              )}
            </div>
          </section>

          <section className="card p-5">
            <p className="text-sm font-semibold text-neutral-900">Validation</p>
            {builder?.validation.shortages.length ? (
              <div className="mt-4 space-y-2">
                {builder.validation.shortages.map((shortage, index) => (
                  <div key={`${shortage.section}-${shortage.constraint}-${index}`} className="rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
                    <strong>{shortage.section}</strong> · {shortage.constraint}: required {shortage.required}, available {shortage.available}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-neutral-500">{builder ? 'Assembly satisfies blueprint validation.' : 'Builder data not loaded yet.'}</p>
            )}
          </section>
        </aside>
      </section>

      {preview && <ExamPreviewModal preview={preview} onClose={() => setPreview(null)} />}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const action = confirmAction.onConfirm;
            setConfirmAction(null);
            action();
          }}
        />
      )}
    </div>
  );
}

function QuestionRow({ question, disabled, onReplace }: { question: ExamPreviewQuestion; disabled?: boolean; onReplace: () => void }) {
  return (
    <SortableRow id={question.id} disabled={disabled}>
      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[4rem_minmax(0,1fr)_8rem] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">Order</p>
          <p className="font-bold text-neutral-900">M{question.order + 1}</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-neutral">{question.type}</span>
            <span className="badge badge-neutral">{question.level}</span>
            <span className="text-sm font-semibold text-neutral-900">{question.points ?? 1} pt</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{question.snippet || 'No preview text'}</p>
          <TagLine tags={question.tags ?? []} />
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onReplace} disabled={disabled}>
          <Shuffle className="h-4 w-4" />
          Replace
        </button>
      </div>
    </SortableRow>
  );
}

function BundleRow({ bundle, disabled, onReplace }: { bundle: ExamPreviewBundle; disabled?: boolean; onReplace: () => void }) {
  return (
    <SortableRow id={bundle.id} disabled={disabled}>
      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[4rem_minmax(0,1fr)_8rem] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">Bundle</p>
          <p className="font-bold text-neutral-900">#{bundle.order + 1}</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900">{bundle.title || 'Untitled bundle'}</span>
            <span className="badge badge-neutral">{bundle.questions.length} questions</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{bundle.snippet || 'No passage preview'}</p>
          <TagLine tags={bundle.tags} />
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onReplace} disabled={disabled}>
          <Shuffle className="h-4 w-4" />
          Replace
        </button>
      </div>
    </SortableRow>
  );
}

function SortableRow({ id, disabled, children }: { id: string; disabled?: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm',
        isDragging && 'border-primary-300 bg-primary-50 shadow-lg',
      )}
    >
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        aria-label="Drag item"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function CandidateCard({
  candidate,
  disabled,
  onChoose,
}: {
  candidate: ExamPreviewQuestion | (ExamPreviewBundle & { sectionType?: 'READING' | 'SCIENCE' });
  disabled?: boolean;
  onChoose: () => void;
}) {
  const isBundle = 'questions' in candidate;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">{isBundle ? candidate.title || 'Untitled bundle' : candidate.type}</p>
          <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{candidate.snippet || 'No preview text'}</p>
        </div>
        <button className="btn btn-secondary btn-sm shrink-0" type="button" onClick={onChoose} disabled={disabled}>
          Use
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isBundle ? <span className="badge badge-neutral">{candidate.questions.length} questions</span> : <span className="badge badge-neutral">{candidate.level}</span>}
        <TagLine tags={candidate.tags ?? []} compact />
      </div>
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

function TagLine({ tags, compact }: { tags: Array<{ id: string; name: string; slug: string }>; compact?: boolean }) {
  const visible = tags.slice(0, compact ? 2 : 4);
  if (visible.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', compact ? 'mt-0' : 'mt-2')}>
      {visible.map((tag) => (
        <span key={tag.id} className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{tag.name}</span>
      ))}
      {tags.length > visible.length && <span className="text-xs text-neutral-500">+{tags.length - visible.length}</span>}
    </div>
  );
}

function ValidationBadge({ ok }: { ok: boolean }) {
  return <span className={cn('badge h-9 px-3', ok ? 'badge-success' : 'badge-danger')}>{ok ? 'Validation OK' : 'Needs review'}</span>;
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-neutral-200 p-5">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', danger ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700')}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold text-neutral-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-neutral-600">{description}</p>
          </div>
        </div>
        <footer className="flex justify-end gap-2 p-4">
          <button type="button" className="btn btn-secondary btn-md" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={cn('btn btn-md', danger ? 'btn-danger' : 'btn-primary')} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function getSectionIds(builder: Awaited<ReturnType<typeof getExamBuilder>> | undefined, section: BuilderSection) {
  if (!builder) return [];
  if (section === 'MATH') return builder.sections.MATH.items?.map((item) => item.id) ?? [];
  return builder.sections[section].bundles?.map((bundle) => bundle.id) ?? [];
}

function candidateMatches(candidate: ExamPreviewQuestion | ExamPreviewBundle, search: string) {
  const haystack = [
    'title' in candidate ? candidate.title : '',
    candidate.snippet,
    ...((candidate.tags ?? []).map((tag) => `${tag.name} ${tag.slug}`)),
    'type' in candidate ? candidate.type : '',
    'level' in candidate ? candidate.level : '',
  ].join(' ').toLowerCase();
  return haystack.includes(search);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
