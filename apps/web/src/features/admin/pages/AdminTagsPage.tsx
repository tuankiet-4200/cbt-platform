import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Edit3, FlaskConical, Plus, Sigma, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listTags, type ExamSectionType, type TagNode } from '../api/questionBank.api';

const SECTIONS: Array<{ value: ExamSectionType; label: string; icon: typeof Sigma; description: string }> = [
  { value: 'MATH', label: 'MATH', icon: Sigma, description: 'Taxonomy for standalone math questions.' },
  { value: 'READING', label: 'READING', icon: BookOpen, description: 'Taxonomy for reading passage bundles.' },
  { value: 'SCIENCE', label: 'SCIENCE', icon: FlaskConical, description: 'Taxonomy for science stimulus bundles.' },
];

export default function AdminTagsPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<ExamSectionType>('MATH');
  const sectionMeta = SECTIONS.find((item) => item.value === section) ?? SECTIONS[0];

  const tagsQuery = useQuery({
    queryKey: ['admin', 'tags', 'list', section],
    queryFn: () => listTags({ sectionType: section }),
  });

  const tags = tagsQuery.data ?? [];
  const flatTags = flattenTags(tags);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Tags className="h-4 w-4" />
            Tag Management
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Quản lý tag</h1>
          <p className="mt-1 text-sm text-neutral-500">{sectionMeta.description}</p>
        </div>
        <span className="badge badge-neutral h-9 justify-center px-3">{flatTags.length} tags</span>
      </header>

      <section className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            {SECTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSection(value)}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition',
                  section === value ? 'bg-primary-600 text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-md" type="button" onClick={() => navigate(`/admin/tags/create?section=${section}`)}>
            <Plus className="h-4 w-4" />
            Add Tag
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <h2 className="font-semibold text-neutral-900">{section} taxonomy</h2>
        </div>
        {tagsQuery.isLoading ? (
          <p className="p-8 text-center text-sm text-neutral-500">Đang tải tag...</p>
        ) : (
          <TagList tags={flatTags} />
        )}
      </section>
    </div>
  );
}

function TagList({ tags }: { tags: TagNode[] }) {
  if (tags.length === 0) {
    return <p className="p-8 text-center text-sm text-neutral-500">Chưa có tag cho section này.</p>;
  }

  return (
    <div className="divide-y divide-neutral-100">
      {tags.map((tag) => (
        <article key={tag.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div style={{ paddingLeft: `${tag.depth * 1.25}rem` }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-primary">{tag.sectionType}</span>
              <span className="badge badge-neutral">Depth {tag.depth}</span>
              <span className="badge badge-neutral">Order {tag.orderIndex}</span>
            </div>
            <p className="mt-3 font-semibold text-neutral-900">{tag.name}</p>
            <p className="mt-1 text-sm text-neutral-500">{tag.slug}</p>
          </div>
          <Link className="btn btn-secondary btn-md" to={`/admin/tags/${tag.id}/edit`}>
            <Edit3 className="h-4 w-4" />
            Edit
          </Link>
        </article>
      ))}
    </div>
  );
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
