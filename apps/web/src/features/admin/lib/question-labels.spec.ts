import { describe, expect, it } from 'vitest';
import { COGNITIVE_LEVELS, cognitiveLevelLabel } from './question-labels';

describe('question difficulty labels', () => {
  it('maps every API level to its Vietnamese label', () => {
    expect(COGNITIVE_LEVELS.map(cognitiveLevelLabel)).toEqual([
      'Nhận biết',
      'Thông hiểu',
      'Vận dụng',
      'Vận dụng cao',
    ]);
  });
});
