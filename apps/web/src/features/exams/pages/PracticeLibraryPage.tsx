import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Dumbbell, FlaskConical, Loader2, Sigma } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  listPracticeTags,
  type PracticeTag,
} from '../api/exams.api';
import type { ExamSectionType } from '@/features/exam/api/sessions.api';

const SECTIONS: Array<{
  value: ExamSectionType;
  label: string;
  icon: typeof Sigma;
}> = [
  { value: 'MATH', label: 'Toán học', icon: Sigma },
  { value: 'READING', label: 'Đọc hiểu', icon: BookOpen },
  { value: 'SCIENCE', label: 'Khoa học', icon: FlaskConical },
];

export default function PracticeLibraryPage() {
  const [section, setSection] = useState<ExamSectionType>('MATH');
  const tagsQuery = useQuery({
    queryKey: ['practice', 'tags'],
    queryFn: listPracticeTags,
  });
  const tags = useMemo(
    () => (tagsQuery.data ?? []).filter((tag) => tag.sectionType === section),
    [section, tagsQuery.data],
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
          <Dumbbell className="h-4 w-4" />
          Luyện tập theo chủ đề
        </div>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">
          Chọn nội dung cần luyện
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Luyện không giới hạn thời gian và có thể xem hoặc ẩn đáp án từng câu.
        </p>
      </header>

      <div className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-2 sm:grid-cols-3">
        {SECTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setSection(value)}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition',
              section === value
                ? 'bg-primary-600 text-white'
                : 'text-neutral-600 hover:bg-neutral-100',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tagsQuery.isLoading && (
        <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          Đang tải danh sách chủ đề...
        </div>
      )}

      {tagsQuery.isError && (
        <div className="card p-6 text-sm text-danger-700">
          Không thể tải chủ đề luyện tập. Vui lòng thử lại.
        </div>
      )}

      {!tagsQuery.isLoading && !tagsQuery.isError && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tags.map((tag) => <TagCard key={tag.id} tag={tag} />)}
          {tags.length === 0 && (
            <div className="card col-span-full p-10 text-center text-sm text-neutral-500">
              Chưa có câu hỏi đã phát hành cho phần này.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TagCard({ tag }: { tag: PracticeTag }) {
  return (
    <article className="card flex min-h-40 flex-col p-5">
      <span className="badge badge-neutral w-fit">
        {tag.depth === 0 ? 'Nhóm chủ đề' : `Cấp ${tag.depth}`}
      </span>
      <h2 className="mt-3 text-lg font-bold text-neutral-900">{tag.name}</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {tag.questionCount} câu hỏi khả dụng
      </p>
      <Link
        to={`/practice/tags/${tag.id}`}
        className="btn btn-primary btn-md mt-auto pt-3"
      >
        <Dumbbell className="h-4 w-4" />
        Bắt đầu luyện
      </Link>
    </article>
  );
}
