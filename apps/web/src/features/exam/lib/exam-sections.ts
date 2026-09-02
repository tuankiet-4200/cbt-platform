import type { ExamSectionType } from '../api/sessions.api';

export const EXAM_SECTION_ORDER: ExamSectionType[] = [
  'MATH',
  'READING',
  'SCIENCE',
];

export const EXAM_SECTION_DURATION_MINS: Record<ExamSectionType, number> = {
  MATH: 60,
  READING: 30,
  SCIENCE: 60,
};

export const EXAM_SECTION_LABELS: Record<ExamSectionType, string> = {
  MATH: 'Tư duy Toán học',
  READING: 'Tư duy Đọc hiểu',
  SCIENCE: 'Khoa học',
};

export function getAvailableExamSections(counts: {
  mathQuestions: number;
  readingQuestions: number;
  scienceQuestions: number;
}) {
  return EXAM_SECTION_ORDER.filter((section) => {
    if (section === 'MATH') return counts.mathQuestions > 0;
    if (section === 'READING') return counts.readingQuestions > 0;
    return counts.scienceQuestions > 0;
  });
}

export function getSectionsDurationMins(sections: ExamSectionType[]) {
  return sections.reduce(
    (total, section) => total + EXAM_SECTION_DURATION_MINS[section],
    0,
  );
}
