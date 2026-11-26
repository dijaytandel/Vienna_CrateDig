import type { ButtonHTMLAttributes } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** A toggle pill, e.g. a filter. */
export function Pill({ selected = false, className = '', ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`pill ${selected ? 'pill-selected' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

interface PillGroupProps<T extends string | number> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Single-choice pills, e.g. the 5 / 10 / 25 mi radius. */
export function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: PillGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="pill-group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`pill ${o.value === value ? 'pill-selected' : ''}`.trim()}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
