import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { RichText } from './RichText';
import type { RichTextNode } from '../api/sessions.api';

interface DragItem {
  id: string;
  content: RichTextNode[];
}

interface DragSlot {
  id: string;
  label?: RichTextNode[];
}

export function DragDropQuestion({
  stem,
  items,
  slots,
  value,
  onChange,
}: {
  stem: RichTextNode[];
  items: DragItem[];
  slots: DragSlot[];
  value: Array<{ slotId: string; itemId: string }>;
  onChange: (value: Array<{ slotId: string; itemId: string }>) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
  );
  const assignedIds = new Set(value.map((entry) => entry.itemId));
  const unassigned = items.filter((item) => !assignedIds.has(item.id));
  const inlineSlotIds = new Set(
    stem.filter((node) => node.type === 'blank').map((node) => node.blankId),
  );
  const legacySlots = slots.filter((slot) => !inlineSlotIds.has(slot.id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const itemId = String(active.id).replace('item:', '');
    const target = String(over.id);
    const withoutDragged = value.filter((entry) => entry.itemId !== itemId);

    if (target === 'pool') {
      onChange(withoutDragged);
      return;
    }
    if (!target.startsWith('slot:')) return;
    const slotId = target.replace('slot:', '');
    onChange([
      ...withoutDragged.filter((entry) => entry.slotId !== slotId),
      { slotId, itemId },
    ]);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="mt-4 space-y-5">
        <ItemPool items={unassigned} />
        <div className="text-[15px] leading-10 text-neutral-900">
          <RichText
            nodes={stem}
            renderBlank={(slotId) => {
              const slot = slots.find((item) => item.id === slotId) ?? { id: slotId };
              const assignedId = value.find((entry) => entry.slotId === slotId)?.itemId;
              const assigned = items.find((item) => item.id === assignedId);
              return (
                <InlineDropSlot key={slotId} slot={slot}>
                  {assigned ? <DraggableItem item={assigned} compact /> : null}
                </InlineDropSlot>
              );
            }}
          />
        </div>
        {legacySlots.length > 0 && <div className="space-y-3">
          {legacySlots.map((slot) => {
            const assignedId = value.find(
              (entry) => entry.slotId === slot.id,
            )?.itemId;
            const assigned = items.find((item) => item.id === assignedId);
            return (
              <DropSlot key={slot.id} slot={slot}>
                {assigned ? <DraggableItem item={assigned} /> : null}
              </DropSlot>
            );
          })}
        </div>}
      </div>
    </DndContext>
  );
}

function ItemPool({ items }: { items: DragItem[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'pool' });
  return (
    <section
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed p-4 transition ${
        isOver
          ? 'border-blue-400 bg-blue-50'
          : 'border-neutral-200 bg-neutral-50'
      }`}
    >
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-500">
        Kéo đáp án vào vị trí phù hợp
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <DraggableItem key={item.id} item={item} compact />
        ))}
        {items.length === 0 && (
          <p className="py-5 text-center text-sm text-neutral-400">
            Tất cả đáp án đã được sử dụng
          </p>
        )}
      </div>
    </section>
  );
}

function InlineDropSlot({ slot, children }: { slot: DragSlot; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot:${slot.id}` });
  return (
    <span
      ref={setNodeRef}
      aria-label={`Vị trí thả ${slot.id}`}
      className={`mx-1 inline-flex min-h-10 min-w-24 items-center justify-center rounded-lg border-2 border-dashed px-1 align-middle transition ${
        isOver
          ? 'border-blue-500 bg-blue-50'
          : children
            ? 'border-blue-300 bg-blue-50/40'
            : 'border-neutral-400 bg-white'
      }`}
    >
      {children ?? <span className="px-3 text-xs text-neutral-400">Thả vào đây</span>}
    </span>
  );
}

function DropSlot({
  slot,
  children,
}: {
  slot: DragSlot;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot:${slot.id}` });
  return (
    <section className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
      <div className="text-sm font-semibold text-neutral-700">
        <RichText nodes={slot.label ?? []} />
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-16 rounded-xl border-2 border-dashed p-2 transition ${
          isOver
            ? 'border-blue-500 bg-blue-50'
            : children
              ? 'border-blue-200 bg-white'
              : 'border-neutral-300 bg-neutral-50'
        }`}
      >
        {children ?? (
          <span className="flex min-h-11 items-center justify-center text-xs text-neutral-400">
            Thả đáp án vào đây
          </span>
        )}
      </div>
    </section>
  );
}

function DraggableItem({ item, compact = false }: { item: DragItem; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `item:${item.id}`,
      data: { itemId: item.id },
    });
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex touch-none items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition ${compact ? 'min-h-9 w-auto' : 'min-h-11 w-full'} ${
        isDragging ? 'z-50 opacity-70 shadow-xl' : 'hover:border-blue-300'
      }`}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-neutral-400" />
      <span className="min-w-0">
        <RichText nodes={item.content} />
      </span>
    </button>
  );
}
