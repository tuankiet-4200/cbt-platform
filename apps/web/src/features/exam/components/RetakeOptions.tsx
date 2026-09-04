import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Loader2, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  createOrResumeAttempt,
  type ExamSectionType,
} from '../api/sessions.api';
import {
  EXAM_SECTION_LABELS,
  getSectionsDurationMins,
} from '../lib/exam-sections';

export function RetakeOptions({
  examId,
  availableSections,
  sectionsOnly = false,
}: {
  examId: string;
  availableSections: ExamSectionType[];
  sectionsOnly?: boolean;
}) {
  const navigate = useNavigate();
  const retakeMutation = useMutation({
    mutationFn: (sectionTypes: ExamSectionType[]) =>
      createOrResumeAttempt(examId, sectionTypes),
    onSuccess: (attempt) => navigate(`/exam/attempt/${attempt.id}`),
  });
  const choices = [
    ...(!sectionsOnly && availableSections.length > 1
      ? [{
          key: 'ALL',
          label: 'Làm lại toàn bộ',
          description: `${getSectionsDurationMins(availableSections)} phút`,
          sections: availableSections,
        }]
      : []),
    ...availableSections.map((section) => ({
      key: section,
      label: EXAM_SECTION_LABELS[section],
      description: `${getSectionsDurationMins([section])} phút`,
      sections: [section],
    })),
  ];

  return (
    <div className="space-y-2">
      {choices.map((choice) => {
        const isCurrent = retakeMutation.isPending &&
          retakeMutation.variables?.join(',') === choice.sections.join(',');
        return (
          <button
            key={choice.key}
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={retakeMutation.isPending}
            onClick={() => retakeMutation.mutate(choice.sections)}
          >
            <span>
              <strong className="block text-sm text-neutral-900">{choice.label}</strong>
              <span className="mt-0.5 block text-xs text-neutral-500">{choice.description}</span>
            </span>
            {isCurrent ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-600" />
            ) : (
              <RotateCcw className="h-4 w-4 shrink-0 text-primary-600" />
            )}
          </button>
        );
      })}
      {retakeMutation.isError && (
        <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {getErrorMessage(retakeMutation.error)}
        </p>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string; error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message
      ?? error.response?.data?.message
      ?? 'Không thể tạo lượt thi mới.';
  }
  return 'Không thể tạo lượt thi mới.';
}
