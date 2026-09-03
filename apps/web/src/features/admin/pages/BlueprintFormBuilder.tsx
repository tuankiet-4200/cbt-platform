import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { SelectField } from '@/components/ui/SelectField';
import type {
  ChildTagRule,
  DifficultyRule,
  ExamBlueprint,
  QuestionTypeRule,
  SectionBlueprint,
} from '../api/exams.api';
import type { CognitiveLevel, ExamSectionType, QuestionType, TagNode } from '../api/questionBank.api';

interface FlatTagOption {
  slug: string;
  label: string;
  depth: number;
}

const SECTIONS: ExamSectionType[] = ['MATH', 'READING', 'SCIENCE'];
const LEVELS: CognitiveLevel[] = ['RECOGNITION', 'COMPREHENSION', 'APPLICATION', 'HIGH_APPLICATION'];
const QUESTION_TYPES: QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE_MATRIX', 'DRAG_DROP', 'FILL_NUMBER', 'FILL_TEXT'];

interface BlueprintFormBuilderProps {
  blueprint: ExamBlueprint;
  tagsBySection: Record<ExamSectionType, TagNode[]>;
  onChange: (blueprint: ExamBlueprint) => void;
}

export function BlueprintFormBuilder({ blueprint, tagsBySection, onChange }: BlueprintFormBuilderProps) {
  const updateBlueprint = (patch: Partial<ExamBlueprint>) => onChange(stripRootTagRules({ ...blueprint, ...patch }));

  const updateSection = (sectionType: ExamSectionType, patch: Partial<SectionBlueprint>) => {
    const sections = ensureSections(blueprint).map((section) =>
      section.sectionType === sectionType ? { ...section, ...patch } : section,
    );
    updateBlueprint({ sections });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold text-neutral-900">Randomization</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="label">Duration</span>
            <input
              className="input"
              type="number"
              min={1}
              max={600}
              value={blueprint.durationMins ?? 150}
              onChange={(event) => updateBlueprint({ durationMins: Number(event.target.value) })}
            />
          </label>
          <label className="block">
            <span className="label">Seed</span>
            <input
              className="input"
              value={blueprint.randomization?.seed ?? ''}
              onChange={(event) => updateBlueprint({
                randomization: { ...blueprint.randomization, seed: event.target.value || undefined },
              })}
              placeholder="optional"
            />
          </label>
          <label className="block">
            <span className="label">Max attempts</span>
            <input
              className="input"
              type="number"
              min={1}
              max={25}
              value={blueprint.randomization?.maxAttempts ?? 5}
              onChange={(event) => updateBlueprint({
                randomization: { ...blueprint.randomization, maxAttempts: Number(event.target.value) },
              })}
            />
          </label>
        </div>
      </section>

      {ensureSections(blueprint).map((section) => (
        <SectionEditor
          key={section.sectionType}
          section={section}
          tags={flattenTags(tagsBySection[section.sectionType] ?? [])}
          onChange={(patch) => updateSection(section.sectionType, patch)}
        />
      ))}
    </div>
  );
}

function SectionEditor({ section, tags, onChange }: {
  section: SectionBlueprint;
  tags: FlatTagOption[];
  onChange: (patch: Partial<SectionBlueprint>) => void;
}) {
  const isMath = section.sectionType === 'MATH';

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{section.sectionType}</h3>
          <p className="mt-1 text-sm text-neutral-500">{isMath ? 'Standalone questions' : 'Atomic passage bundles'}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{isMath ? 'Questions' : 'Questions total'}</span>
            <input
              className="input"
              type="number"
              min={0}
              value={section.targetQuestionCount ?? 0}
              onChange={(event) => onChange({ targetQuestionCount: Number(event.target.value) })}
            />
          </label>
          {!isMath && (
            <label className="block">
              <span className="label">Bundles</span>
              <input
                className="input"
                type="number"
                min={0}
                value={section.targetBundleCount ?? 0}
                onChange={(event) => onChange({ targetBundleCount: Number(event.target.value) })}
              />
            </label>
          )}
        </div>
      </div>

      <RuleGroup
        title="Tag min/max"
        addLabel="Add tag rule"
        rows={section.childTagRules ?? []}
        onAdd={() => onChange({ childTagRules: [...(section.childTagRules ?? []), { tagSlug: tags[0]?.slug, min: 0, max: undefined }] })}
        render={(rule, index) => (
          <TagRuleCard
            rule={rule}
            tags={tags}
            onChange={(patch) => updateChildRule(section, index, patch, onChange)}
            onRemove={() => removeChildRule(section, index, onChange)}
          />
        )}
      />

      {isMath && (
        <RuleGroup
          title="Question type rules"
          addLabel="Add type"
          rows={section.questionTypeRules ?? []}
          onAdd={() => onChange({ questionTypeRules: [...(section.questionTypeRules ?? []), { type: 'SINGLE_CHOICE', min: 1 }] })}
          render={(rule, index) => (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_8rem_2.5rem]">
              <label className="block">
                <span className="label">Type</span>
                <SelectField
                  value={rule.type}
                  options={QUESTION_TYPES.map((type) => ({ value: type, label: type }))}
                  onChange={(value) => updateQuestionTypeRule(section, index, { type: value as QuestionType }, onChange)}
                />
              </label>
              <NumberInput label="Count" value={rule.count ?? 0} onChange={(count) => updateQuestionTypeRule(section, index, { count: count || undefined }, onChange)} />
              <NumberInput label="Percent" value={rule.percent ?? 0} onChange={(percent) => updateQuestionTypeRule(section, index, { percent: percent || undefined }, onChange)} />
              <NumberInput label="Min" value={rule.min ?? 0} onChange={(min) => updateQuestionTypeRule(section, index, { min: min || undefined }, onChange)} />
              <NumberInput label="Max" value={rule.max ?? 0} onChange={(max) => updateQuestionTypeRule(section, index, { max: max || undefined }, onChange)} />
              <DeleteButton onClick={() => removeQuestionTypeRule(section, index, onChange)} />
            </div>
          )}
        />
      )}
    </section>
  );
}

function RuleGroup<T>({ title, addLabel, rows, onAdd, render }: {
  title: string;
  addLabel: string;
  rows: T[];
  onAdd: () => void;
  render: (row: T, index: number) => ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-neutral-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-neutral-800">{title}</h4>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-3">{rows.map(render)}</div>
      ) : (
        <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">No rules configured.</p>
      )}
    </div>
  );
}

function TagRuleCard({
  rule,
  tags,
  onChange,
  onRemove,
}: {
  rule: ChildTagRule;
  tags: FlatTagOption[];
  onChange: (patch: Partial<ChildTagRule>) => void;
  onRemove: () => void;
}) {
  const childRules = rule.childTagRules ?? [];
  const difficultyRules = rule.difficultyRules ?? [];

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_2.5rem]">
        <TagSelect value={rule.tagSlug ?? ''} tags={tags} onChange={(tagSlug) => onChange({ tagSlug })} />
        <NumberInput label="Min" value={rule.min ?? 0} onChange={(min) => onChange({ min: min || undefined })} />
        <NumberInput label="Max" value={rule.max ?? 0} onChange={(max) => onChange({ max: max || undefined })} />
        <DeleteButton onClick={onRemove} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <NestedRulePanel
          title="Sub tag min/max"
          addLabel="Add sub tag"
          rows={childRules}
          onAdd={() => onChange({ childTagRules: [...childRules, { tagSlug: tags[0]?.slug, min: 0, max: undefined }] })}
          render={(childRule, index) => (
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_5rem_5rem_2.5rem]">
              <TagSelect value={childRule.tagSlug ?? ''} tags={tags} onChange={(tagSlug) => updateNestedChildRule(rule, index, { tagSlug }, onChange)} />
              <NumberInput label="Min" value={childRule.min ?? 0} onChange={(min) => updateNestedChildRule(rule, index, { min: min || undefined }, onChange)} />
              <NumberInput label="Max" value={childRule.max ?? 0} onChange={(max) => updateNestedChildRule(rule, index, { max: max || undefined }, onChange)} />
              <DeleteButton onClick={() => onChange({ childTagRules: childRules.filter((_, itemIndex) => itemIndex !== index) })} />
            </div>
          )}
        />
        <NestedRulePanel
          title="Difficulty in tag"
          addLabel="Add difficulty"
          rows={difficultyRules}
          onAdd={() => onChange({ difficultyRules: [...difficultyRules, { level: 'RECOGNITION', min: 1 }] })}
          render={(difficultyRule, index) => (
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_5rem_5rem_2.5rem]">
              <label className="block">
                <span className="label">Level</span>
                <SelectField
                  value={difficultyRule.level}
                  options={LEVELS.map((level) => ({ value: level, label: level }))}
                  onChange={(value) => updateNestedDifficultyRule(rule, index, { level: value as CognitiveLevel }, onChange)}
                />
              </label>
              <NumberInput label="Min" value={difficultyRule.min ?? 0} onChange={(min) => updateNestedDifficultyRule(rule, index, { min: min || undefined }, onChange)} />
              <NumberInput label="Max" value={difficultyRule.max ?? 0} onChange={(max) => updateNestedDifficultyRule(rule, index, { max: max || undefined }, onChange)} />
              <DeleteButton onClick={() => onChange({ difficultyRules: difficultyRules.filter((_, itemIndex) => itemIndex !== index) })} />
            </div>
          )}
        />
      </div>
    </div>
  );
}

function NestedRulePanel<T>({
  title,
  addLabel,
  rows,
  onAdd,
  render,
}: {
  title: string;
  addLabel: string;
  rows: T[];
  onAdd: () => void;
  render: (row: T, index: number) => ReactNode;
}) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-3">{rows.map(render)}</div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No nested rules.</p>
      )}
    </div>
  );
}

function TagSelect({ value, tags, onChange }: { value: string; tags: FlatTagOption[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">Tag</span>
      <SelectField
        value={value}
        options={tags.length === 0 ? [{ value: '', label: 'No tags', disabled: true }] : tags.map((tag) => ({ value: tag.slug, label: tag.label, depth: tag.depth }))}
        placeholder="Select tag"
        onChange={onChange}
      />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mt-6 flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:bg-danger-50 hover:text-danger-700" onClick={onClick}>
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function updateChildRule(section: SectionBlueprint, index: number, patch: Partial<ChildTagRule>, onChange: (patch: Partial<SectionBlueprint>) => void) {
  const childTagRules = [...(section.childTagRules ?? [])];
  childTagRules[index] = { ...childTagRules[index], ...patch };
  onChange({ childTagRules });
}

function removeChildRule(section: SectionBlueprint, index: number, onChange: (patch: Partial<SectionBlueprint>) => void) {
  onChange({ childTagRules: (section.childTagRules ?? []).filter((_, itemIndex) => itemIndex !== index) });
}

function updateQuestionTypeRule(section: SectionBlueprint, index: number, patch: Partial<QuestionTypeRule>, onChange: (patch: Partial<SectionBlueprint>) => void) {
  const questionTypeRules = [...(section.questionTypeRules ?? [])];
  questionTypeRules[index] = { ...questionTypeRules[index], ...patch };
  onChange({ questionTypeRules });
}

function updateNestedChildRule(rule: ChildTagRule, index: number, patch: Partial<ChildTagRule>, onChange: (patch: Partial<ChildTagRule>) => void) {
  const childTagRules = [...(rule.childTagRules ?? [])];
  childTagRules[index] = { ...childTagRules[index], ...patch };
  onChange({ childTagRules });
}

function updateNestedDifficultyRule(rule: ChildTagRule, index: number, patch: Partial<DifficultyRule>, onChange: (patch: Partial<ChildTagRule>) => void) {
  const difficultyRules = [...(rule.difficultyRules ?? [])];
  difficultyRules[index] = { ...difficultyRules[index], ...patch };
  onChange({ difficultyRules });
}

function removeQuestionTypeRule(section: SectionBlueprint, index: number, onChange: (patch: Partial<SectionBlueprint>) => void) {
  onChange({ questionTypeRules: (section.questionTypeRules ?? []).filter((_, itemIndex) => itemIndex !== index) });
}

function ensureSections(blueprint: ExamBlueprint) {
  const existing = new Map(blueprint.sections.map((section) => [section.sectionType, section]));
  return SECTIONS.map((sectionType) => existing.get(sectionType) ?? defaultSection(sectionType));
}

function stripRootTagRules(blueprint: ExamBlueprint): ExamBlueprint {
  return {
    ...blueprint,
    sections: ensureSections(blueprint).map((section) => {
      const { rootTagRules: _rootTagRules, ...rest } = section;
      return rest;
    }),
  };
}

function defaultSection(sectionType: ExamSectionType): SectionBlueprint {
  if (sectionType === 'MATH') return { sectionType, targetQuestionCount: 50 };
  if (sectionType === 'READING') return { sectionType, targetBundleCount: 2, targetQuestionCount: 20 };
  return { sectionType, targetBundleCount: 3, targetQuestionCount: 15 };
}

function flattenTags(tags: TagNode[], depth = 0): FlatTagOption[] {
  return tags.flatMap((tag) => [
    { slug: tag.slug, label: tag.name, depth },
    ...flattenTags(tag.children ?? [], depth + 1),
  ]);
}
