import { useId, useState, type KeyboardEvent } from 'react';

interface Props {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxLength?: number;
}

export default function TagInput({ label, value, onChange, placeholder, maxLength = 40 }: Props) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim().replace(/,+$/, '').trim();
    setDraft('');
    if (!tag || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="tag-input">
      <label htmlFor={id}>{label}</label>
      <ul className="tag-list" aria-label={`${label} tags`}>
        {value.map((tag) => (
          <li key={tag} className="pill pill-selected">
            {tag}
            <button
              type="button"
              className="pill-remove"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        className="input"
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        enterKeyHint="enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
    </div>
  );
}
