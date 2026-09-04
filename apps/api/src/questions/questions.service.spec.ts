import { PrismaService } from '@/common/prisma/prisma.service';
import { QuestionsService } from './questions.service';

describe('QuestionsService content updates', () => {
  const questionFindUnique = jest.fn();
  const questionUpdate = jest.fn();
  const passageBundleFindUnique = jest.fn();
  const passageBundleUpdate = jest.fn();
  const prisma = {
    question: {
      findUnique: questionFindUnique,
      update: questionUpdate,
    },
    passageBundle: {
      findUnique: passageBundleFindUnique,
      update: passageBundleUpdate,
    },
    $transaction: jest.fn(
      async (callback: (tx: unknown) => unknown) => callback(prisma),
    ),
  } as unknown as PrismaService;
  const service = new QuestionsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows content changes when the question belongs to a published exam', async () => {
    questionFindUnique.mockResolvedValue({
      id: 'question-1',
      type: 'SINGLE_CHOICE',
    });
    questionUpdate.mockResolvedValue({ id: 'question-1' });

    await expect(
      service.updateQuestion('question-1', { expectedTimeSecs: 120 }),
    ).resolves.toEqual({ id: 'question-1' });
    expect(questionFindUnique).toHaveBeenCalledTimes(1);
    expect(questionUpdate).toHaveBeenCalled();
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

  it('allows passage bundle content changes after the bundle is used', async () => {
    passageBundleFindUnique.mockResolvedValue({
      id: 'bundle-1',
      sectionType: 'READING',
    });
    passageBundleUpdate.mockResolvedValue({ id: 'bundle-1' });

    await expect(
      service.updatePassageBundle('bundle-1', { title: 'Đoạn đọc đã sửa' }),
    ).resolves.toEqual({ id: 'bundle-1' });
    expect(passageBundleFindUnique).toHaveBeenCalledTimes(1);
    expect(passageBundleUpdate).toHaveBeenCalled();
  });
});
