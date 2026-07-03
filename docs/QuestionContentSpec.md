# Question Content Specification v1.0

> **Status:** APPROVED ✅  
> **Agreed by:** Backend, Frontend  
> **Last updated:** Sprint 1.1

Đây là **contract** định nghĩa format JSON lưu trữ trong cột `content_json` (JSONB) của bảng `questions`.
Frontend và Backend phải tuân thủ spec này. Mọi thay đổi phải được đồng thuận và cập nhật version.

---

## Root Structure

```typescript
interface QuestionContent {
  /** Nội dung đề bài — hỗ trợ văn bản + LaTeX + ảnh */
  stem: RichTextNode[];
  
  /** Loại câu hỏi — xác định payload schema */
  type: 'SINGLE_CHOICE' | 'TRUE_FALSE_MATRIX' | 'DRAG_DROP' | 'FILL_NUMBER';
  
  /** Dữ liệu câu hỏi — schema phụ thuộc vào `type` */
  payload: SingleChoicePayload | TrueFalsePayload | DragDropPayload | FillNumberPayload;
  
  /** Lời giải — tuỳ chọn, hiển thị sau khi chấm bài */
  solution?: RichTextNode[];
  
  /** Phiên bản schema (để migrate dữ liệu sau này) */
  _version: 1;
}
```

---

## RichTextNode — Định dạng văn bản phong phú

```typescript
type RichTextNode =
  | { type: 'text';  content: string }                  // Văn bản thuần
  | { type: 'latex'; content: string }                  // Công thức LaTeX inline ($...$)
  | { type: 'latex_block'; content: string }            // Công thức LaTeX block ($$...$$)
  | { type: 'image'; url: string; alt?: string; width?: number } // Ảnh từ cloud storage
  | { type: 'bold';  content: string }                  // Chữ đậm
  | { type: 'italic'; content: string }                 // Chữ nghiêng
  | { type: 'break' }                                   // Xuống dòng
```

**Frontend rendering rule:** Iterate qua mảng `RichTextNode[]`, render từng node theo `type`.  
Dùng `<MathRenderer>` component wrap `react-katex` để render LaTeX.

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
  "_version": 1
}
```

---

## Type 2: TRUE_FALSE_MATRIX (Đúng/Sai theo hàng)

```typescript
interface TrueFalsePayload {
  /** Mô tả ngữ cảnh chung (nếu có, hiển thị trên bảng) */
  context?: RichTextNode[];
  statements: {
    id: string;              // 'S1' | 'S2' | 'S3' | 'S4'
    content: RichTextNode[];
    isTrue: boolean;         // Đáp án đúng của phát biểu này
  }[];
  /** Điểm thành phần: mỗi phát biểu đúng được bao nhiêu phần điểm */
  pointsPerStatement?: number; // Mặc định: 1/statements.length
}
```

**Grading logic:** Mỗi statement chấm độc lập. Tổng điểm câu = Σ(điểm các statement đúng).

**Answer format:** `{ answers: { statementId: string, value: boolean }[] }`

**Example:**
```json
{
  "stem": [{"type": "text", "content": "Xét tính đúng/sai của các phát biểu sau về hàm số:"}],
  "type": "TRUE_FALSE_MATRIX",
  "payload": {
    "statements": [
      {"id": "S1", "content": [{"type": "latex", "content": "f(x) = x^2 \\geq 0 \\, \\forall x"}], "isTrue": true},
      {"id": "S2", "content": [{"type": "latex", "content": "f(x) = x^2"}], "isTrue": false},
      {"id": "S3", "content": [{"type": "text", "content": "Hàm số đơn điệu tăng trên R"}], "isTrue": false},
      {"id": "S4", "content": [{"type": "latex", "content": "f'(0) = 0"}], "isTrue": true}
    ]
  },
  "_version": 1
}
```

---

## Type 3: DRAG_DROP (Kéo thả)

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
  /** Mỗi slot nhận đúng/sai được tính bao nhiêu điểm */
  pointsPerSlot?: number;
}
```

**Grading logic:** Mỗi slot chấm: `answer.slots[slot.id] === slot.correctItemId`

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
  "_version": 1
}
```

---

## Type 4: FILL_NUMBER (Điền số)

```typescript
interface FillNumberPayload {
  /** Đáp án đúng (số) */
  correctValue: number;
  /** Sai số chấp nhận được. Mặc định: 0.001 */
  tolerance?: number;
  /** Đơn vị hiển thị (nếu có) */
  unit?: string;
  /** Giới hạn input */
  min?: number;
  max?: number;
}
```

**Grading logic:** `|answer.value - correctValue| <= tolerance`

**Answer format:** `{ value: number }`

**Example:**
```json
{
  "stem": [{"type": "text", "content": "Tính "},
           {"type": "latex", "content": "\\int_0^1 2x \\, dx"},
           {"type": "text", "content": " = ?"}],
  "type": "FILL_NUMBER",
  "payload": {
    "correctValue": 1,
    "tolerance": 0.001,
    "unit": ""
  },
  "_version": 1
}
```

---

## IRT Params Schema

Lưu trong cột `irt_params` (JSONB):

```typescript
interface IrtParams {
  /** Discrimination parameter — Độ phân hóa. Range: [0, 3], typical: [0.5, 2.0] */
  a: number;
  /** Difficulty parameter — Độ khó. Range: [-3, 3], 0 = trung bình */
  b: number;
  /** Guessing parameter — Xác suất đoán mò. Range: [0, 0.35] */
  c: number;
}

// Defaults khi chưa có dữ liệu đủ lớn:
const DEFAULT_IRT: IrtParams = { a: 1.0, b: 0.0, c: 0.25 };

// Xác suất trả lời đúng cho thí sinh có năng lực θ:
// P(θ) = c + (1-c) / (1 + e^(-a(θ-b)))
```

---

## Answer Format Summary

| Type | Answer JSON stored in `answerJson` |
|------|----------------------------------|
| SINGLE_CHOICE | `{ "selectedOptionId": "B" }` |
| TRUE_FALSE_MATRIX | `{ "answers": [{"statementId": "S1", "value": true}, ...] }` |
| DRAG_DROP | `{ "slots": [{"slotId": "slot1", "itemId": "I2"}, ...] }` |
| FILL_NUMBER | `{ "value": 3.14 }` |

---

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | Sprint 1.1 | Initial spec — 4 question types defined |
