import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, FlaskConical, Loader2, Sigma, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  createTag,
  getTag,
  listTags,
  updateTag,
  type ExamSectionType,
  type TagNode,
  type UpsertTagPayload,
} from '../api/questionBank.api';

const SECTIONS: Array<{ value: ExamSectionType; label: string; icon: typeof Sigma; description: string }> = [
  { value: 'MATH', label: 'MATH', icon: Sigma, description: 'Create or edit math taxonomy.' },
  { value: 'READING', label: 'READING', icon: BookOpen, description: 'Create or edit reading taxonomy.' },
  { value: 'SCIENCE', label: 'SCIENCE', icon: FlaskConical, description: 'Create or edit science taxonomy.' },
];

interface TagFormState {
  name: string;
  slug: string;
  sectionType: ExamSectionType;
  parentId: string;
  orderIndex: number;
}

export default function AdminTagEditorPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams<{ tagId?: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(params.tagId);
  const [initialSection] = useState<ExamSectionType>(() => normalizeSection(searchParams.get('section')));
  const [form, setForm] = useState<TagFormState>(() => ({
    name: '',
    slug: '',
    sectionType: initialSection,
    parentId: '',
    orderIndex: 0,
  }));
  const [hasEditedSlug, setHasEditedSlug] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tagQuery = useQuery({
    queryKey: ['admin', 'tags', params.tagId],
    queryFn: () => getTag(params.tagId ?? ''),
    enabled: isEditMode,
  });

  const tagsQuery = useQuery({
    queryKey: ['admin', 'tags', 'parents', form.sectionType],
    queryFn: () => listTags({ sectionType: form.sectionType }),
  });

  const parentOptions = useMemo(
    () => flattenTags(tagsQuery.data ?? []).filter((tag) => tag.id !== params.tagId && tag.depth < 3),
    [params.tagId, tagsQuery.data],
  );

  useEffect(() => {
    const tag = tagQuery.data;
    if (!tag) return;
    setForm({
      name: tag.name,
      slug: tag.slug,
      sectionType: tag.sectionType,
      parentId: tag.parentId ?? '',
      orderIndex: tag.orderIndex,
    });
    setHasEditedSlug(true);
  }, [tagQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: UpsertTagPayload) => createTag(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
      navigate('/admin/tags');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpsertTagPayload) => updateTag(params.tagId ?? '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
      navigate('/admin/tags');
    },
  });

  const sectionMeta = SECTIONS.find((item) => item.value === form.sectionType) ?? SECTIONS[0];

  const patch = (value: Partial<TagFormState>) => setForm((current) => ({ ...current, ...value }));

  const handleNameChange = (name: string) => {
    setForm((current) => ({
      ...current,
      name,
      slug: hasEditedSlug ? current.slug : slugify(name),
    }));
  };

  const handleSectionChange = (sectionType: ExamSectionType) => {
    patch({ sectionType, parentId: '' });
    setFormError(null);
    if (!isEditMode) navigate(`/admin/tags/create?section=${sectionType}`, { replace: true });
  };

  const submit = () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Tên tag không được để trống.');
      return;
    }
    if (!form.slug.trim()) {
      setFormError('Slug không được để trống.');
      return;
    }

    const payload: UpsertTagPayload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      sectionType: form.sectionType,
      parentId: form.parentId || undefined,
      orderIndex: form.orderIndex,
    };

    if (isEditMode) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {tagQuery.isLoading && <div className="card p-5 text-sm text-neutral-500">Đang tải tag...</div>}

      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Tags className="h-4 w-4" />
            {isEditMode ? 'Edit Tag' : 'Create Tag'}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">{isEditMode ? 'Chỉnh sửa tag' : 'Tạo tag'}</h1>
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
                form.sectionType === value ? 'bg-primary-600 text-white' : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <TagForm
          form={form}
          parentOptions={parentOptions}
          error={formError ?? getErrorMessage(createMutation.error) ?? getErrorMessage(updateMutation.error)}
          isPending={createMutation.isPending || updateMutation.isPending}
          onNameChange={handleNameChange}
          onSlugChange={(slug) => {
            setHasEditedSlug(true);
            patch({ slug });
          }}
          onPatch={patch}
          onSubmit={submit}
          submitLabel={isEditMode ? 'Cập nhật tag' : 'Tạo tag'}
        />

        <aside className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Preview</p>
          <div className="mt-4 rounded-lg border border-neutral-200 p-4">
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary">{form.sectionType}</span>
              <span className="badge badge-neutral">Depth auto</span>
            </div>
            <p className="mt-3 font-semibold text-neutral-900">{form.name || 'Tên tag'}</p>
            <p className="mt-1 text-sm text-neutral-500">{form.slug || 'slug'}</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TagForm({
  form,
  parentOptions,
  error,
  isPending,
  onNameChange,
  onSlugChange,
  onPatch,
  onSubmit,
  submitLabel,
}: {
  form: TagFormState;
  parentOptions: TagNode[];
  error: string | null;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onPatch: (value: Partial<TagFormState>) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="card p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input className="input" value={form.name} onChange={(event) => onNameChange(event.target.value)} />
        </Field>
        <Field label="Slug">
          <input className="input" value={form.slug} onChange={(event) => onSlugChange(slugify(event.target.value))} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Parent tag">
          <select className="input" value={form.parentId} onChange={(event) => onPatch({ parentId: event.target.value })}>
            <option value="">Root tag</option>
            {parentOptions.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {'- '.repeat(tag.depth)}{tag.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order">
          <input
            className="input"
            type="number"
            min={0}
            value={form.orderIndex}
            onChange={(event) => onPatch({ orderIndex: Number(event.target.value) })}
          />
        </Field>
      </div>

      <div className="mt-5 border-t border-neutral-200 pt-5">
        {error && <p className="mb-4 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>}
        <div className="flex justify-end">
          <button className="btn btn-primary btn-md" type="button" disabled={isPending} onClick={onSubmit}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function normalizeSection(value: string | null): ExamSectionType {
  if (value === 'READING' || value === 'SCIENCE') return value;
  return 'MATH';
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

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return null;
}
