import { ConflictException } from '@nestjs/common';
import { PrismaService } from '@/common/prisma/prisma.service';
import { QuestionsService } from './questions.service';

describe('QuestionsService published content protection', () => {
  const questionFindUnique = jest.fn();
  const questionUpdate = jest.fn();
  const prisma = {
    question: {
      findUnique: questionFindUnique,
      update: questionUpdate,
    },
    $transaction: jest.fn(
      async (callback: (tx: unknown) => unknown) => callback(prisma),
    ),
  } as unknown as PrismaService;
  const service = new QuestionsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks content changes when the question belongs to a published exam', async () => {
    questionFindUnique
      .mockResolvedValueOnce({
        id: 'question-1',
        type: 'SINGLE_CHOICE',
      })
      .mockResolvedValueOnce({
        mathExamItems: [{ examId: 'exam-1' }],
        bundleQuestion: null,
      });

    await expect(
      service.updateQuestion('question-1', { expectedTimeSecs: 120 }),
    ).rejects.toThrow(ConflictException);
    expect(questionUpdate).not.toHaveBeenCalled();
  });

  it('allows review notes without changing immutable grading content', async () => {
    questionFindUnique.mockResolvedValue({
      id: 'question-1',
      type: 'SINGLE_CHOICE',
    });
    questionUpdate.mockResolvedValue({ id: 'question-1' });

    await service.updateQuestion('question-1', {
      reviewNote: 'Đã kiểm tra nội dung.',
    });

    expect(questionFindUnique).toHaveBeenCalledTimes(1);
    expect(questionUpdate).toHaveBeenCalled();
  });
});
