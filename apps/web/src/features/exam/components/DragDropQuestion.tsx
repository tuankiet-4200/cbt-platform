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
        <div className="text-[1em] leading-[2.5] text-neutral-900">
          <RichText
            nodes={stem}
            renderBlank={(slotId) => {
              const slot = slots.find((item) => item.id === slotId) ?? { id: slotId };
              const assignedId = value.find((entry) => entry.slotId === slotId)?.itemId;
              const assigned = items.find((item) => item.id === assignedId);
              return (
                <InlineDropSlot key={slotId} slot={slot}>
                  {assigned ? <DraggableItem item={assigned} compact fillSlot /> : null}
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
                {assigned ? <DraggableItem item={assigned} fillSlot /> : null}
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
      className={`rounded-lg px-2 py-3 transition ${isOver ? 'bg-primary-50' : ''}`}
    >
      <p className="mb-4 text-xs font-bold uppercase tracking-wide text-neutral-500">
        Các phương án
      </p>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-3">
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
      className={`inline-flex min-h-10 min-w-28 items-stretch justify-center overflow-hidden rounded-lg border border-dashed align-middle ${
        isOver
          ? 'border-primary-500 bg-primary-50'
          : children
            ? 'border-primary-300 bg-primary-50/40'
            : 'border-neutral-500 bg-white'
      }`}
    >
      {children}
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
        className={`min-h-16 overflow-hidden rounded-xl border-2 border-dashed ${
          isOver
            ? 'border-blue-500 bg-blue-50'
            : children
              ? 'border-blue-200 bg-white'
              : 'border-neutral-300 bg-neutral-50'
        }`}
      >
        {children}
      </div>
    </section>
  );
}

function DraggableItem({
  item,
  compact = false,
  fillSlot = false,
}: {
  item: DragItem;
  compact?: boolean;
  fillSlot?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `item:${item.id}`,
      data: { itemId: item.id },
    });
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        transform: CSS.Translate.toString(transform),
        willChange: isDragging ? 'transform' : undefined,
      }}
      className={`flex touch-none select-none items-center gap-2 rounded-lg border px-3 py-2 text-left text-[0.95em] cursor-grab active:cursor-grabbing ${
        compact
          ? `min-h-9 border-transparent bg-[#f3bbc2] px-5 text-neutral-800 shadow-none hover:bg-[#efaab4] ${fillSlot ? 'min-h-10 w-full self-stretch justify-center rounded-[inherit]' : 'w-auto'}`
          : 'min-h-11 w-full border-neutral-200 bg-white shadow-sm hover:border-blue-300'
      } ${
        isDragging ? 'z-50 opacity-70 shadow-xl' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      {!compact && <GripVertical className="h-4 w-4 shrink-0 text-neutral-400" />}
      <span className="min-w-0">
        <RichText nodes={item.content} />
      </span>
    </button>
  );
}
