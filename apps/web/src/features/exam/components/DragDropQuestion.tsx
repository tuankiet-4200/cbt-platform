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
  items,
  slots,
  value,
  onChange,
}: {
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
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <ItemPool items={unassigned} />
        <div className="space-y-3">
          {slots.map((slot) => {
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
        </div>
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
      <div className="space-y-2">
        {items.map((item) => (
          <DraggableItem key={item.id} item={item} />
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

function DraggableItem({ item }: { item: DragItem }) {
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
      className={`flex min-h-11 w-full touch-none items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition ${
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
