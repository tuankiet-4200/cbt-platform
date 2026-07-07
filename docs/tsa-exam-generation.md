# TSA Exam Generation

## Purpose

The TSA exam generator uses a constraint-first, random-second workflow. It does
not pick random content first and hope the result looks balanced. It validates a
blueprint, builds eligible candidate pools, checks availability, samples inside
valid pools with a seed, validates the final selection, and saves the result as
a draft exam for admin review.

## Current Data Model

Generation writes into the existing exam assembly tables:

- `ExamMathQuestion` for standalone MATH questions.
- `ExamPassageBundle` for READING and SCIENCE bundles.

The `Exam` row stores draft generation metadata:

- `blueprintJson`: validated blueprint used for generation.
- `generationSeed`: seed used for the saved draft.
- `generatedAt`: timestamp of the latest generation.

The blueprint is stored as JSON for Sprint 2.2 speed. Normalized blueprint
tables can be added later when reusable blueprint management becomes important.

## Taxonomy Design

Tags are section-aware via `Tag.sectionType`.

Root tags are defined as:

- `parentId = null`
- `depth = 0`

Current root taxonomy:

### MATH

- `so-hoc` — Số học
- `dai-so` — Đại số
- `ham-so` — Hàm số
- `hinh-hoc` — Hình học
- `thong-ke-xac-suat` — Thống kê - Xác suất

`toan-hoc` is kept only as a legacy child tag and must not be used as the MATH
root for generation.

### READING

- `doc-khoa-hoc` — Khoa học
- `doc-cong-nghe` — Công nghệ
- `doc-kinh-te` — Kinh tế
- `doc-ky-thuat` — Kỹ thuật
- `doc-cong-nghiep` — Công nghiệp
- `doc-nong-nghiep` — Nông nghiệp
- `doc-tai-chinh` — Tài chính
- `doc-ngan-hang` — Ngân hàng
- `doc-y-duoc` — Y dược

`doc-hieu` is kept only as a legacy child tag and must not be used as the sole
READING root.

### SCIENCE

- `vat-ly` — Vật lý
- `hoa-hoc` — Hóa học
- `sinh-hoc` — Sinh học

## Core Generation Rules

- MATH uses standalone `Question` records only.
- READING uses whole `PassageBundle` records only.
- SCIENCE uses whole `PassageBundle` records only.
- READING and SCIENCE questions are never selected individually.
- `PassageBundle` is atomic.
- Only `PUBLISHED` content can be selected.
- A generated exam cannot contain duplicate MATH questions.
- A generated exam cannot contain duplicate passage bundles.
- READING bundles must contain exactly 10 questions.
- SCIENCE bundles must contain exactly 5 questions.
- Generated exams are saved as drafts; publishing validates the saved selection
  against the blueprint again.

## Blueprint Shape

Example:

```json
{
  "version": 1,
  "durationMins": 150,
  "randomization": {
    "seed": "tsa-demo-001",
    "maxAttempts": 5
  },
  "sections": [
    {
      "sectionType": "MATH",
      "targetQuestionCount": 50,
      "rootTagRules": [
        { "tagSlug": "dai-so", "count": 12 },
        { "tagSlug": "ham-so", "count": 10 }
      ],
      "childTagRules": [
        { "tagSlug": "cuc-tri", "min": 2, "max": 5 }
      ],
      "difficultyRules": [
        { "level": "RECOGNITION", "percent": 20 },
        { "level": "COMPREHENSION", "percent": 30 },
        { "level": "APPLICATION", "percent": 35 },
        { "level": "HIGH_APPLICATION", "percent": 15 }
      ]
    },
    {
      "sectionType": "READING",
      "targetBundleCount": 2,
      "targetQuestionCount": 20,
      "rootTagRules": [
        { "tagSlug": "doc-khoa-hoc", "count": 1 },
        { "tagSlug": "doc-cong-nghe", "count": 1 }
      ]
    },
    {
      "sectionType": "SCIENCE",
      "targetBundleCount": 3,
      "targetQuestionCount": 15,
      "rootTagRules": [
        { "tagSlug": "vat-ly", "count": 1 },
        { "tagSlug": "hoa-hoc", "count": 1 },
        { "tagSlug": "sinh-hoc", "count": 1 }
      ]
    }
  ]
}
```

If sections are omitted, the backend fills in default TSA structure:

- MATH: 50 standalone questions.
- READING: 2 bundles, 20 questions.
- SCIENCE: 3 bundles, 15 questions.

## Workflow

1. Load and normalize blueprint.
2. Build candidate pools:
   - MATH: published standalone questions.
   - READING: published READING bundles with exactly 10 questions.
   - SCIENCE: published SCIENCE bundles with exactly 5 questions.
3. Apply hard filters:
   - status = `PUBLISHED`
   - correct section type
   - standalone vs bundle
   - valid bundle size
4. Resolve root and child tag rules as tag subtrees.
5. Check availability before generation.
6. Sample candidates with seeded randomness.
7. Validate final selection:
   - target counts
   - child tag min/max
   - cognitive level min/count/percent rules
8. Retry with seed suffixes up to `maxAttempts`.
9. Save selected content into exam assembly tables as a draft.
10. Admin previews and publishes separately.

## Shortage Report

When constraints cannot be satisfied, the API returns a shortage report:

```json
{
  "ok": false,
  "shortages": [
    {
      "section": "MATH",
      "constraint": "difficulty HIGH_APPLICATION",
      "required": 8,
      "available": 3,
      "unit": "question-level"
    }
  ]
}
```

Shortages are designed to tell admins what content must be added to the question
bank before the blueprint can generate a valid exam.

## API Endpoints

All routes are admin-only.

- `POST /api/v1/admin/exams`
  - Creates an exam draft with optional `blueprintJson`.

- `PATCH /api/v1/admin/exams/:id/blueprint`
  - Updates `blueprintJson`, keeps the exam unpublished.

- `POST /api/v1/admin/exams/blueprint/availability`
  - Checks a blueprint without requiring an existing exam.

- `GET /api/v1/admin/exams/:id/availability`
  - Checks the saved blueprint for an existing exam.

- `POST /api/v1/admin/exams/:id/generate`
  - Generates a draft from the saved blueprint.
  - Body: `{ "seed": "optional", "maxAttempts": 5 }`

- `POST /api/v1/admin/exams/:id/regenerate`
  - Generates again with the same blueprint and a different default seed unless
    a seed is provided.

- `GET /api/v1/admin/exams/:id/preview`
  - Returns generated section counts, difficulty breakdown, seed, and blueprint.

- `PATCH /api/v1/admin/exams/:id/publish`
  - Body: `{ "isPublished": true }`
  - Revalidates saved generated content before publishing.

## Current Limitations

- Blueprint storage is JSON, not normalized tables.
- The sampler validates child tag min/max and difficulty after selection; it is
  not yet a full constraint solver.
- Root tag `count` means:
  - MATH: number of questions.
  - READING/SCIENCE: number of bundles.
- Difficulty rules for READING/SCIENCE are evaluated against the questions
  inside selected bundles.
- Question type rules are parsed for future MATH support but are not yet used as
  hard selection constraints.
- `avoidRecentlyUsed` and historical exposure balancing are not implemented yet.
- IRT `b` difficulty is not used yet; current generation uses `CognitiveLevel`.

## Future Improvements

- Normalize blueprint tables after the admin workflow stabilizes.
- Add a proper multi-dimensional constraint solver for exact intersections of
  root tag, child tag, difficulty, and question type.
- Add content exposure tracking to avoid overusing the same questions/bundles.
- Use calibrated IRT `b` values for finer difficulty targeting.
- Add admin UI for shortage reports and manual replacement/locking of generated
  items before publish.
