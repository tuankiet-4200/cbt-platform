export function orderQuestionOptions<T extends { id: string }>(
  options: T[],
  displayOrder: unknown,
  shuffleSeed: string,
  questionId: string,
) {
  if (displayOrder !== 'shuffle') return options;
  return [...options].sort((left, right) => {
    const leftRank = deterministicRank(
      `${shuffleSeed}:${questionId}:${left.id}`,
    );
    const rightRank = deterministicRank(
      `${shuffleSeed}:${questionId}:${right.id}`,
    );
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });
}

function deterministicRank(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
