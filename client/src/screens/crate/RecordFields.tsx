import { Pill } from '../../components/ui/Pill';
import TagInput from '../../components/ui/TagInput';
import { ATTRIBUTE_SUGGESTIONS, CONDITIONS } from '../../lib/format';
import type { FieldValues } from './fields';

/** Condition, attributes, USD price and notes, shared by add and edit. */
export default function RecordFields({
  values,
  onChange,
  priceLabel = 'Price paid (USD)',
  priceError,
}: {
  values: FieldValues;
  onChange: (v: FieldValues) => void;
  priceLabel?: string;
  priceError?: string | null;
}) {
  const set = <K extends keyof FieldValues>(k: K, v: FieldValues[K]) =>
    onChange({ ...values, [k]: v });
  const missing = ATTRIBUTE_SUGGESTIONS.filter((a) => !values.specialAttributes.includes(a));
  return (
    <>
      <fieldset className="field plain">
        <legend>Condition (optional)</legend>
        <div className="tag-list">
          {CONDITIONS.map((c) => (
            <Pill
              key={c.value}
              type="button"
              selected={values.conditionGrade === c.value}
              aria-pressed={values.conditionGrade === c.value}
              onClick={() =>
                set('conditionGrade', values.conditionGrade === c.value ? null : c.value)
              }
            >
              {c.label}
            </Pill>
          ))}
        </div>
      </fieldset>
      <TagInput
        label="Special attributes"
        value={values.specialAttributes}
        onChange={(tags) => set('specialAttributes', tags.slice(0, 10))}
        placeholder="Type and press Enter"
      />
      {missing.length > 0 && (
        <div className="tag-list" aria-label="Suggested attributes">
          {missing.map((a) => (
            <Pill
              key={a}
              type="button"
              onClick={() =>
                set('specialAttributes', [...values.specialAttributes, a].slice(0, 10))
              }
            >
              + {a}
            </Pill>
          ))}
        </div>
      )}
      <label className="field">
        {priceLabel}
        <input
          className="input"
          inputMode="decimal"
          placeholder="$0.00"
          value={values.price}
          onChange={(e) => set('price', e.target.value)}
          aria-invalid={!!priceError}
        />
        {priceError && <span className="form-error">{priceError}</span>}
      </label>
      <label className="field">
        Notes
        <textarea
          className="input"
          rows={3}
          maxLength={1000}
          value={values.userNotes}
          onChange={(e) => set('userNotes', e.target.value)}
        />
      </label>
    </>
  );
}
