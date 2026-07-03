# Question Content Specification v2.0

> **Status:** APPROVED ✅  
> **Agreed by:** Backend, Frontend  
> **Last updated:** Sprint 1.1 (Rev 2)

Đây là **contract** định nghĩa format JSON lưu trữ trong cột `content_json` (JSONB) của bảng `questions`.  
Frontend và Backend phải tuân thủ spec này. Mọi thay đổi phải được đồng thuận và cập nhật version.

---

## Root Structure

```typescript
interface QuestionContent {
  /** Nội dung đề bài — hỗ trợ văn bản + LaTeX + ảnh */
  stem: RichTextNode[];
  
  /** Loại câu hỏi — xác định payload schema */
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE_MATRIX' | 'DRAG_DROP' | 'FILL_NUMBER';
  
  /** Dữ liệu câu hỏi — schema phụ thuộc vào `type` */
  payload:
    | SingleChoicePayload
    | MultipleChoicePayload
    | TrueFalsePayload
    | DragDropPayload
    | FillNumberPayload;
  
  /** Lời giải — tuỳ chọn, hiển thị sau khi chấm bài */
  solution?: RichTextNode[];
  
  /** Phiên bản schema (để migrate dữ liệu sau này) */
  _version: 2;
}
```

---

## ⚖️ Quy Tắc Chấm Điểm Tổng Quát

| Type | Chấm điểm |
|------|-----------|
| `SINGLE_CHOICE` | Đúng = full điểm / Sai = 0 |
| `MULTIPLE_CHOICE` | **All-or-nothing** — phải chọn ĐÚNG và ĐỦ tất cả đáp án đúng, không thiếu không thừa |
| `TRUE_FALSE_MATRIX` | **All-or-nothing** — phải trả lời đúng TẤT CẢ các phát biểu |
| `DRAG_DROP` | **All-or-nothing** — phải đặt đúng item vào TẤT CẢ các slot |
| `FILL_NUMBER` | **Exact match** — giá trị nhập phải khớp CHÍNH XÁC với `correctValue` |

> **Lý do all-or-nothing:** Theo cấu trúc đề thi TSA thực tế, các câu hỏi dạng ma trận/kéo thả/điền là một "câu" thống nhất. Không có điểm thành phần.

---

## RichTextNode — Định dạng văn bản phong phú

```typescript
type RichTextNode =
  | { type: 'text';        content: string }                          // Văn bản thuần
  | { type: 'latex';       content: string }                          // LaTeX inline ($...$)
  | { type: 'latex_block'; content: string }                          // LaTeX block ($$...$$)
  | { type: 'image';       url: string; alt?: string; width?: number }// Ảnh từ cloud storage
  | { type: 'bold';        content: string }                          // Chữ đậm
  | { type: 'italic';      content: string }                          // Chữ nghiêng
  | { type: 'break' }                                                 // Xuống dòng
  | { type: 'blank' }                                                 // Ô trống cần điền (dùng trong stem của FILL_NUMBER)
```

**Frontend rendering rule:** Iterate qua mảng `RichTextNode[]`, render từng node theo `type`.  
Dùng `<MathRenderer>` component wrap `react-katex` để render LaTeX.  
Node `blank` render thành `<input>` hoặc `[____]` tùy context.

---

## Type 1: SINGLE_CHOICE (Trắc nghiệm 1 đáp án đúng)

```typescript
interface SingleChoicePayload {
  options: {
    id: string;          // 'A' | 'B' | 'C' | 'D' | 'E' (tối đa 5 lựa chọn)
    content: RichTextNode[];
    isCorrect: boolean;  // TRUE chỉ cho 1 option duy nhất
  }[];
  /** Thứ tự hiển thị: 'original' (mặc định) | 'shuffle' (random mỗi lần) */
  displayOrder?: 'original' | 'shuffle';
}
```

**Grading logic:** `answer.selectedOptionId === option.id where option.isCorrect === true`

**Answer format:** `{ selectedOptionId: string }`

**Example:**
```json
{
  "stem": [{"type": "text", "content": "Tìm giá trị của "},
           {"type": "latex", "content": "\\lim_{x \\to 0} \\frac{\\sin x}{x}"}],
  "type": "SINGLE_CHOICE",
  "payload": {
    "options": [
      {"id": "A", "content": [{"type": "latex", "content": "0"}], "isCorrect": false},
      {"id": "B", "content": [{"type": "latex", "content": "1"}], "isCorrect": true},
      {"id": "C", "content": [{"type": "latex", "content": "-1"}], "isCorrect": false},
      {"id": "D", "content": [{"type": "text", "content": "Không tồn tại"}], "isCorrect": false}
    ]
  },
  "_version": 2
}
```

---

## Type 2: MULTIPLE_CHOICE (Trắc nghiệm nhiều đáp án đúng)

Thí sinh phải chọn **tất cả** các đáp án đúng — không thiếu, không thừa.

```typescript
interface MultipleChoicePayload {
  options: {
    id: string;          // 'A' | 'B' | 'C' | 'D' | 'E' (tối đa 5 lựa chọn)
    content: RichTextNode[];
    isCorrect: boolean;  // Có thể nhiều option có isCorrect = true
  }[];
  displayOrder?: 'original' | 'shuffle';
}
```

**Grading logic (all-or-nothing):**
```
correctIds = options.filter(o => o.isCorrect).map(o => o.id)  // sorted
submittedIds = answer.selectedOptionIds  // sorted
isCorrect = deepEqual(correctIds, submittedIds)
```

**Answer format:** `{ selectedOptionIds: string[] }` — thứ tự không quan trọng, backend sẽ sort trước khi so sánh.

**Example:**
```json
{
  "stem": [{"type": "text", "content": "Chọn các số nguyên tố nhỏ hơn 10:"}],
  "type": "MULTIPLE_CHOICE",
  "payload": {
    "options": [
      {"id": "A", "content": [{"type": "text", "content": "2"}], "isCorrect": true},
      {"id": "B", "content": [{"type": "text", "content": "3"}], "isCorrect": true},
      {"id": "C", "content": [{"type": "text", "content": "4"}], "isCorrect": false},
      {"id": "D", "content": [{"type": "text", "content": "5"}], "isCorrect": true},
      {"id": "E", "content": [{"type": "text", "content": "9"}], "isCorrect": false}
    ]
  },
  "_version": 2
}
```

---

## Type 3: TRUE_FALSE_MATRIX (Đúng/Sai — All-or-Nothing)

Thí sinh phải đánh giá đúng/sai cho **tất cả** các phát biểu thì mới được điểm.

```typescript
interface TrueFalsePayload {
  /** Ngữ cảnh chung hiển thị phía trên bảng (tuỳ chọn) */
  context?: RichTextNode[];
  statements: {
    id: string;              // 'S1' | 'S2' | 'S3' | 'S4'
    content: RichTextNode[];
    isTrue: boolean;         // Đáp án đúng của phát biểu này
  }[];
}
```

**Grading logic (all-or-nothing):**
```
isCorrect = statements.every(s => answer.answers[s.id] === s.isTrue)
```
Nếu **bất kỳ 1 phát biểu nào sai** → toàn câu **0 điểm**.

**Answer format:** `{ answers: { statementId: string, value: boolean }[] }`

**Example:**
```json
{
  "stem": [{"type": "text", "content": "Xét tính đúng/sai của các phát biểu sau về hàm số y = x²:"}],
  "type": "TRUE_FALSE_MATRIX",
  "payload": {
    "statements": [
      {"id": "S1", "content": [{"type": "latex", "content": "f(x) \\geq 0 \\; \\forall x \\in \\mathbb{R}"}], "isTrue": true},
      {"id": "S2", "content": [{"type": "text", "content": "Hàm số đơn điệu tăng trên R"}], "isTrue": false},
      {"id": "S3", "content": [{"type": "latex", "content": "f'(0) = 0"}], "isTrue": true},
      {"id": "S4", "content": [{"type": "text", "content": "Đồ thị nhận trục Oy làm trục đối xứng"}], "isTrue": true}
    ]
  },
  "_version": 2
}
```

---

## Type 4: DRAG_DROP (Kéo thả — All-or-Nothing)

Thí sinh phải đặt đúng item vào **tất cả** slot thì mới được điểm.

```typescript
interface DragDropPayload {
  /** Các item có thể kéo */
  items: {
    id: string;
    content: RichTextNode[];
  }[];
  /** Các slot mà item được thả vào */
  slots: {
    id: string;
    label?: RichTextNode[]; // Nhãn slot (hiển thị bên cạnh ô thả)
    correctItemId: string;  // ID của item đúng cho slot này
  }[];
}
```

**Grading logic (all-or-nothing):**
```
isCorrect = slots.every(s => answer.slots[s.id] === s.correctItemId)
```
Nếu **bất kỳ 1 slot nào sai** → toàn câu **0 điểm**.

**Answer format:** `{ slots: { slotId: string, itemId: string }[] }`

**Example (Sắp xếp bước giải phương trình):**
```json
{
  "stem": [{"type": "text", "content": "Kéo các bước vào đúng thứ tự giải phương trình:"}],
  "type": "DRAG_DROP",
  "payload": {
    "items": [
      {"id": "I1", "content": [{"type": "latex", "content": "2x = 6"}]},
      {"id": "I2", "content": [{"type": "latex", "content": "x + 3 = 6"}]},
      {"id": "I3", "content": [{"type": "latex", "content": "x = 3"}]}
    ],
    "slots": [
      {"id": "slot1", "label": [{"type": "text", "content": "Bước 1"}], "correctItemId": "I2"},
      {"id": "slot2", "label": [{"type": "text", "content": "Bước 2"}], "correctItemId": "I1"},
      {"id": "slot3", "label": [{"type": "text", "content": "Kết quả"}], "correctItemId": "I3"}
    ]
  },
  "_version": 2
}
```

---

## Type 5: FILL_NUMBER (Điền số — Exact Match)

Thí sinh điền **một số** vào ô trống. Giá trị phải khớp **chính xác** với `correctValue`.

> **Lưu ý:** Không còn `tolerance`. Backend so sánh `answer.value === payload.correctValue` (sau khi parse về Number).  
> Frontend chịu trách nhiệm format input theo `displayFormat` trước khi submit.

```typescript
interface FillNumberPayload {
  /** Đáp án đúng — exact match required */
  correctValue: number;

  /**
   * Gợi ý định dạng hiển thị cho Frontend:
   * - 'integer'        → Số nguyên, ví dụ: 42
   * - 'decimal_2'      → 2 chữ số thập phân, ví dụ: 3.14
   * - 'decimal_comma'  → Dùng dấu phẩy thập phân (chuẩn Việt Nam), ví dụ: 3,14
   */
  displayFormat?: 'integer' | 'decimal_2' | 'decimal_comma';

  /** Đơn vị hiển thị bên cạnh ô nhập (VD: "năm ánh sáng", "m/s²") */
  unit?: string;

  /** Giới hạn input cho UX validation (không ảnh hưởng grading) */
  min?: number;
  max?: number;
}
```

**Grading logic (exact match):**
```
submittedNum = parseFloat(answer.value.toString().replace(',', '.'))
isCorrect = submittedNum === payload.correctValue
```

**Answer format:** `{ value: number }`

**Example:**
```json
{
  "stem": [
    {"type": "text", "content": "Khoảng cách giữa hai ngôi sao xấp xỉ "},
    {"type": "blank"},
    {"type": "text", "content": " năm ánh sáng."}
  ],
  "type": "FILL_NUMBER",
  "payload": {
    "correctValue": 25000,
    "displayFormat": "integer",
    "unit": "năm ánh sáng"
  },
  "_version": 2
}
```

---

## Passage (Bài dẫn — Đọc hiểu & Khoa học)

Trong đề TSA, phần **Đọc hiểu** và **Khoa học** sử dụng giao diện **2 cột**:
- **Cột trái:** Đoạn văn bản dẫn (Passage) — không tính điểm
- **Cột phải:** Tập hợp 4–6 câu hỏi liên quan — **điểm tính riêng từng câu**

Passage được lưu trong bảng `passages` (JSONB `content_json`) với cùng cú pháp `RichTextNode[]`, hỗ trợ đầy đủ text, LaTeX, ảnh, bảng số liệu.

```typescript
interface PassageContent {
  nodes: RichTextNode[]; // Toàn bộ nội dung bài dẫn
}
```

**Quy tắc liên kết:**
- `ExamQuestion.passageId` = null → câu toán đơn lẻ (MATH section)
- `ExamQuestion.passageId` ≠ null → câu đọc hiểu/khoa học gắn với bài dẫn

---

## IRT Params Schema

Lưu trong cột `irt_params` (JSONB) trên bảng `questions`.

```typescript
interface IrtParams {
  /** Discrimination parameter — Độ phân hóa. Range: [0, 3], typical: [0.5, 2.0] */
  a: number;
  /** Difficulty parameter — Độ khó. Range: [-3, 3], 0 = trung bình */
  b: number;
  /** Guessing parameter — Xác suất đoán mò. Range: [0, 0.35] */
  c: number;
}

// Default khi tạo câu hỏi mới (chưa có đủ dữ liệu hiệu chỉnh):
const DEFAULT_IRT: IrtParams = { a: 1.0, b: 0.0, c: 0.25 };
```

> **Cài IRT khi tạo câu hỏi:** Admin có thể truyền `irtParams` khi gọi `POST /questions`. Nếu không truyền, hệ thống tự điền default `{ a: 1.0, b: 0.0, c: 0.25 }`. Sau khi đủ dữ liệu thí sinh, giá trị sẽ được cập nhật bằng thuật toán hiệu chỉnh IRT (Sprint 4).

Xác suất trả lời đúng cho thí sinh có năng lực θ:
```
P(θ) = c + (1-c) / (1 + e^(-a(θ-b)))
```

---

## Answer Format Summary

| Type | Answer JSON stored in `answerJson` |
|------|----------------------------------|
| SINGLE_CHOICE | `{ "selectedOptionId": "B" }` |
| MULTIPLE_CHOICE | `{ "selectedOptionIds": ["A", "C", "D"] }` |
| TRUE_FALSE_MATRIX | `{ "answers": [{"statementId": "S1", "value": true}, ...] }` |
| DRAG_DROP | `{ "slots": [{"slotId": "slot1", "itemId": "I2"}, ...] }` |
| FILL_NUMBER | `{ "value": 25000 }` |

---

## Section Score Schema (ExamResult.sectionScores)

```typescript
interface SectionScore {
  section: 'MATH' | 'READING' | 'SCIENCE';
  score: number;       // Điểm đạt được trong phần này
  maxScore: number;    // Điểm tối đa của phần này
  correct: number;     // Số câu đúng
  total: number;       // Tổng số câu
}

// ExamResult.sectionScores = SectionScore[]
```

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | Sprint 1.1 | Initial spec — 4 question types |
| 2.0 | Sprint 1.1 Rev2 | Add MULTIPLE_CHOICE; FILL_NUMBER → exact match (remove tolerance); TRUE_FALSE/DRAG_DROP → all-or-nothing; Add Passage concept; Add section score schema |
