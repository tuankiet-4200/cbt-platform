import type { CognitiveLevel } from '../api/questionBank.api';

export const COGNITIVE_LEVELS: CognitiveLevel[] = [
  'RECOGNITION',
  'COMPREHENSION',
  'APPLICATION',
  'HIGH_APPLICATION',
];

export const COGNITIVE_LEVEL_OPTIONS: Array<{ value: CognitiveLevel; label: string }> = [
  { value: 'RECOGNITION', label: 'Nhận biết' },
  { value: 'COMPREHENSION', label: 'Thông hiểu' },
  { value: 'APPLICATION', label: 'Vận dụng' },
  { value: 'HIGH_APPLICATION', label: 'Vận dụng cao' },
];

const COGNITIVE_LEVEL_LABELS = Object.fromEntries(
  COGNITIVE_LEVEL_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<CognitiveLevel, string>;

export function cognitiveLevelLabel(level: CognitiveLevel) {
  return COGNITIVE_LEVEL_LABELS[level];
}
