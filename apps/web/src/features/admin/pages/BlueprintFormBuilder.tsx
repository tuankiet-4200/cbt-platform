import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  ChildTagRule,
  DifficultyRule,
  ExamBlueprint,
  QuestionTypeRule,
  SectionBlueprint,
  TagRule,
} from '../api/exams.api';
import type { CognitiveLevel, ExamSectionType, QuestionType, TagNode } from '../api/questionBank.api';

const SECTIONS: ExamSectionType[] = ['MATH', 'READING', 'SCIENCE'];
const LEVELS: CognitiveLevel[] = ['RECOGNITION', 'COMPREHENSION', 'APPLICATION', 'HIGH_APPLICATION'];
const QUESTION_TYPES: QuestionType[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE_MATRIX', 'DRAG_DROP', 'FILL_NUMBER'];

interface BlueprintFormBuilderProps {
  blueprint: ExamBlueprint;
  tagsBySection: Record<ExamSectionType, TagNode[]>;
  onChange: (blueprint: ExamBlueprint) => void;
}

export function BlueprintFormBuilder({ blueprint, tagsBySection, onChange }: BlueprintFormBuilderProps) {
  const updateBlueprint = (patch: Partial<ExamBlueprint>) => onChange({ ...blueprint, ...patch });

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
  tags: Array<{ slug: string; label: string }>;
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
        title="Root tag quota"
        addLabel="Add root tag"
        rows={section.rootTagRules ?? []}
        onAdd={() => onChange({ rootTagRules: [...(section.rootTagRules ?? []), { tagSlug: tags[0]?.slug, count: 1 }] })}
        render={(rule, index) => (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_2.5rem]">
            <TagSelect value={rule.tagSlug ?? ''} tags={tags} onChange={(tagSlug) => updateRootRule(section, index, { tagSlug }, onChange)} />
            <NumberInput label="Count" value={rule.count ?? 0} onChange={(count) => updateRootRule(section, index, { count }, onChange)} />
            <DeleteButton onClick={() => removeRootRule(section, index, onChange)} />
          </div>
        )}
      />

      <RuleGroup
        title="Child tag min/max"
        addLabel="Add child rule"
        rows={section.childTagRules ?? []}
        onAdd={() => onChange({ childTagRules: [...(section.childTagRules ?? []), { tagSlug: tags[0]?.slug, min: 0, max: undefined }] })}
        render={(rule, index) => (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_2.5rem]">
            <TagSelect value={rule.tagSlug ?? ''} tags={tags} onChange={(tagSlug) => updateChildRule(section, index, { tagSlug }, onChange)} />
            <NumberInput label="Min" value={rule.min ?? 0} onChange={(min) => updateChildRule(section, index, { min }, onChange)} />
            <NumberInput label="Max" value={rule.max ?? 0} onChange={(max) => updateChildRule(section, index, { max: max || undefined }, onChange)} />
            <DeleteButton onClick={() => removeChildRule(section, index, onChange)} />
          </div>
        )}
      />

      <RuleGroup
        title="Difficulty rules"
        addLabel="Add difficulty"
        rows={section.difficultyRules ?? []}
        onAdd={() => onChange({ difficultyRules: [...(section.difficultyRules ?? []), { level: 'RECOGNITION', min: 1 }] })}
        render={(rule, index) => (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_8rem_2.5rem]">
            <label className="block">
              <span className="label">Level</span>
              <select className="input" value={rule.level} onChange={(event) => updateDifficultyRule(section, index, { level: event.target.value as CognitiveLevel }, onChange)}>
                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <NumberInput label="Count" value={rule.count ?? 0} onChange={(count) => updateDifficultyRule(section, index, { count: count || undefined }, onChange)} />
            <NumberInput label="Percent" value={rule.percent ?? 0} onChange={(percent) => updateDifficultyRule(section, index, { percent: percent || undefined }, onChange)} />
            <NumberInput label="Min" value={rule.min ?? 0} onChange={(min) => updateDifficultyRule(section, index, { min: min || undefined }, onChange)} />
            <NumberInput label="Max" value={rule.max ?? 0} onChange={(max) => updateDifficultyRule(section, index, { max: max || undefined }, onChange)} />
            <DeleteButton onClick={() => removeDifficultyRule(section, index, onChange)} />
          </div>
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
                <select className="input" value={rule.type} onChange={(event) => updateQuestionTypeRule(section, index, { type: event.target.value as QuestionType }, onChange)}>
                  {QUESTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
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

function TagSelect({ value, tags, onChange }: { value: string; tags: Array<{ slug: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="label">Tag</span>
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {tags.length === 0 && <option value="">No tags</option>}
        {tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.label}</option>)}
      </select>
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

function updateRootRule(section: SectionBlueprint, index: number, patch: Partial<TagRule>, onChange: (patch: Partial<SectionBlueprint>) => void) {
  const rootTagRules = [...(section.rootTagRules ?? [])];
  rootTagRules[index] = { ...rootTagRules[index], ...patch };
  onChange({ rootTagRules });
}

function removeRootRule(section: SectionBlueprint, index: number, onChange: (patch: Partial<SectionBlueprint>) => void) {
  onChange({ rootTagRules: (section.rootTagRules ?? []).filter((_, itemIndex) => itemIndex !== index) });
}

function updateChildRule(section: SectionBlueprint, index: number, patch: Partial<ChildTagRule>, onChange: (patch: Partial<SectionBlueprint>) => void) {
  const childTagRules = [...(section.childTagRules ?? [])];
  childTagRules[index] = { ...childTagRules[index], ...patch };
  onChange({ childTagRules });
}

function removeChildRule(section: SectionBlueprint, index: number, onChange: (patch: Partial<SectionBlueprint>) => void) {
  onChange({ childTagRules: (section.childTagRules ?? []).filter((_, itemIndex) => itemIndex !== index) });
}

function updateDifficultyRule(section: SectionBlueprint, index: number, patch: Partial<DifficultyRule>, onChange: (patch: Partial<SectionBlueprint>) => void) {
  const difficultyRules = [...(section.difficultyRules ?? [])];
  difficultyRules[index] = { ...difficultyRules[index], ...patch };
  onChange({ difficultyRules });
}

function removeDifficultyRule(section: SectionBlueprint, index: number, onChange: (patch: Partial<SectionBlueprint>) => void) {
  onChange({ difficultyRules: (section.difficultyRules ?? []).filter((_, itemIndex) => itemIndex !== index) });
}

function updateQuestionTypeRule(section: SectionBlueprint, index: number, patch: Partial<QuestionTypeRule>, onChange: (patch: Partial<SectionBlueprint>) => void) {
  const questionTypeRules = [...(section.questionTypeRules ?? [])];
  questionTypeRules[index] = { ...questionTypeRules[index], ...patch };
  onChange({ questionTypeRules });
}

function removeQuestionTypeRule(section: SectionBlueprint, index: number, onChange: (patch: Partial<SectionBlueprint>) => void) {
  onChange({ questionTypeRules: (section.questionTypeRules ?? []).filter((_, itemIndex) => itemIndex !== index) });
}

function ensureSections(blueprint: ExamBlueprint) {
  const existing = new Map(blueprint.sections.map((section) => [section.sectionType, section]));
  return SECTIONS.map((sectionType) => existing.get(sectionType) ?? defaultSection(sectionType));
}

function defaultSection(sectionType: ExamSectionType): SectionBlueprint {
  if (sectionType === 'MATH') return { sectionType, targetQuestionCount: 50 };
  if (sectionType === 'READING') return { sectionType, targetBundleCount: 2, targetQuestionCount: 20 };
  return { sectionType, targetBundleCount: 3, targetQuestionCount: 15 };
}

function flattenTags(tags: TagNode[], depth = 0): Array<{ slug: string; label: string }> {
  return tags.flatMap((tag) => [
    { slug: tag.slug, label: `${'  '.repeat(depth)}${tag.name}` },
    ...flattenTags(tag.children ?? [], depth + 1),
  ]);
}
