import { useMemo } from 'react';
import { RichText } from './RichText';
import { DragDropQuestion } from './DragDropQuestion';
import type { RichTextNode, SessionQuestion } from '../api/sessions.api';
import { orderQuestionOptions } from '../lib/question-order';

type Answer = Record<string, unknown>;

interface Option {
  id: string;
  content: RichTextNode[];
}

interface Statement {
  id: string;
  content: RichTextNode[];
}

interface DragItem {
  id: string;
  content: RichTextNode[];
}

interface DragSlot {
  id: string;
  label?: RichTextNode[];
}

interface FillBlank {
  id: string;
  displayFormat?: string;
  unit?: string;
  min?: number;
  max?: number;
}

export function QuestionRenderer({
  question,
  answer,
  onAnswer,
  shuffleSeed,
  readOnly = false,
}: {
  question: SessionQuestion;
  answer?: Answer;
  onAnswer: (answer: Answer) => void;
  shuffleSeed: string;
  readOnly?: boolean;
}) {
  const payload = question.content.payload;
  const orderedOptions = useMemo(() => {
    const options = (payload.options ?? []) as Option[];
    return orderQuestionOptions(
      options,
      payload.displayOrder,
      shuffleSeed,
      question.id,
    );
  }, [payload.displayOrder, payload.options, question.id, shuffleSeed]);
  const statements = (payload.statements ?? []) as Statement[];
  const items = (payload.items ?? []) as DragItem[];
  const slots = (payload.slots ?? []) as DragSlot[];
  const blanks = (payload.blanks ?? []) as FillBlank[];

  const fillAnswer = (answer?.blanks ?? []) as Array<{
    blankId: string;
    value: number | string;
  }>;

  const setBlank = (blankId: string, value: string) => {
    const next = fillAnswer.filter((item) => item.blankId !== blankId);
    if (value !== '') next.push({ blankId, value });
    onAnswer({ blanks: next });
  };

  return (
    <article>
      <div className="text-[15px] leading-8 text-neutral-900">
        <RichText
          nodes={question.content.stem}
          renderBlank={(blankId) => {
            const blank = blanks.find((item) => item.id === blankId);
            const value =
              fillAnswer.find((item) => item.blankId === blankId)?.value ?? '';
            return (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  inputMode={question.type === 'FILL_NUMBER' ? 'decimal' : 'text'}
                  value={String(value)}
                  onChange={(event) => setBlank(blankId, event.target.value)}
                  readOnly={readOnly}
                  className="h-8 w-28 border-0 border-b-2 border-blue-400 bg-transparent px-2 text-center outline-none focus:border-blue-600"
                  aria-label={`Ô trả lời ${blankId}`}
                />
                {blank?.unit && (
                  <span className="text-sm text-neutral-500">{blank.unit}</span>
                )}
              </span>
            );
          }}
        />
      </div>

      {question.type === 'SINGLE_CHOICE' && (
        <div className="mt-5 space-y-3">
          {orderedOptions.map((option) => (
            <AnswerOption
              key={option.id}
              selected={answer?.selectedOptionId === option.id}
              onClick={() => onAnswer({ selectedOptionId: option.id })}
              disabled={readOnly}
              content={option.content}
            />
          ))}
        </div>
      )}

      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="mt-5 space-y-3">
          {orderedOptions.map((option) => {
            const selectedIds =
              (answer?.selectedOptionIds as string[] | undefined) ?? [];
            const selected = selectedIds.includes(option.id);
            return (
              <AnswerOption
                key={option.id}
                selected={selected}
                square
                onClick={() =>
                  onAnswer({
                    selectedOptionIds: selected
                      ? selectedIds.filter((id) => id !== option.id)
                      : [...selectedIds, option.id],
                  })
                }
                disabled={readOnly}
                content={option.content}
              />
            );
          })}
        </div>
      )}

      {question.type === 'TRUE_FALSE_MATRIX' && (
        <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200">
          <div className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] bg-neutral-50 text-center text-sm font-semibold">
            <span />
            <span className="p-3">Đúng</span>
            <span className="p-3">Sai</span>
          </div>
          {statements.map((statement) => {
            const values =
              (answer?.answers as Array<{
                statementId: string;
                value: boolean;
              }> | undefined) ?? [];
            const current = values.find(
              (item) => item.statementId === statement.id,
            )?.value;
            const setValue = (value: boolean) =>
              onAnswer({
                answers: [
                  ...values.filter(
                    (item) => item.statementId !== statement.id,
                  ),
                  { statementId: statement.id, value },
                ],
              });
            return (
              <div
                key={statement.id}
                className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] border-t border-neutral-200"
              >
                <div className="p-3 text-sm leading-6">
                  <RichText nodes={statement.content} />
                </div>
                <MatrixChoice
                  selected={current === true}
                  onClick={() => setValue(true)}
                  label={`${statement.id} đúng`}
                  disabled={readOnly}
                />
                <MatrixChoice
                  selected={current === false}
                  onClick={() => setValue(false)}
                  label={`${statement.id} sai`}
                  disabled={readOnly}
                />
              </div>
            );
          })}
        </div>
      )}

      {question.type === 'DRAG_DROP' && (
        <div className={readOnly ? 'pointer-events-none' : undefined} aria-disabled={readOnly}>
          <DragDropQuestion
            items={items}
            slots={slots}
            value={
              (answer?.slots as Array<{
                slotId: string;
                itemId: string;
              }> | undefined) ?? []
            }
            onChange={(value) => onAnswer({ slots: value })}
          />
        </div>
      )}
    </article>
  );
}

function AnswerOption({
  selected,
  square,
  onClick,
  content,
  disabled,
}: {
  selected: boolean;
  square?: boolean;
  onClick: () => void;
  content: RichTextNode[];
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm leading-6 transition ${
        selected
          ? 'border-blue-400 bg-blue-50 text-blue-950'
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      <span
        className={`mt-0.5 h-5 w-5 shrink-0 border-2 ${
          square ? 'rounded-md' : 'rounded-full'
        } ${
          selected
            ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_4px_white]'
            : 'border-neutral-300'
        }`}
      />
      <span>
        <RichText nodes={content} />
      </span>
    </button>
  );
}

function MatrixChoice({
  selected,
  onClick,
  label,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex items-center justify-center border-l border-neutral-200"
    >
      <span
        className={`h-7 w-7 rounded-full ${
          selected
            ? 'bg-blue-600 shadow-[inset_0_0_0_6px_white] ring-2 ring-blue-600'
            : 'bg-neutral-200'
        }`}
      />
    </button>
  );
}
