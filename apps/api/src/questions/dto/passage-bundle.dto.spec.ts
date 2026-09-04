import { ValidationPipe } from '@nestjs/common';
import {
  CreatePassageBundleWithQuestionsDto,
  UpdatePassageBundleDto,
} from './passage-bundle.dto';

describe('PassageBundle DTO contentJson transformation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const contentJson = [
    { type: 'text', content: 'Đoạn văn' },
    { type: 'break' },
    { type: 'latex', content: 'x^2' },
  ];

  it('preserves rich-text nodes when creating a Reading or Science bundle', async () => {
    const result = await pipe.transform(
      {
        sectionType: 'READING',
        title: 'Bài đọc',
        contentJson,
        questions: [],
      },
      { type: 'body', metatype: CreatePassageBundleWithQuestionsDto },
    );

    expect(result.contentJson).toEqual(contentJson);
  });

  it('preserves rich-text nodes when updating a bundle', async () => {
    const result = await pipe.transform(
      { contentJson },
      { type: 'body', metatype: UpdatePassageBundleDto },
    );

    expect(result.contentJson).toEqual(contentJson);
  });
});
