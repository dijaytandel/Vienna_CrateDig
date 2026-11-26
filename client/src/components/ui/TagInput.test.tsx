import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import TagInput from './TagInput';

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagInput label="Genres" value={tags} onChange={setTags} />;
}

const tags = () => screen.queryAllByRole('listitem').map((li) => li.firstChild?.textContent);

describe('TagInput', () => {
  it('adds a pill on Enter and on comma', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Genres');
    fireEvent.change(input, { target: { value: 'Jazz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'Soul' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(tags()).toEqual(['Jazz', 'Soul']);
    expect(input).toHaveValue('');
  });

  it('ignores blanks and case-insensitive duplicates', () => {
    render(<Harness initial={['Jazz']} />);
    const input = screen.getByLabelText('Genres');
    fireEvent.change(input, { target: { value: ' jazz ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(tags()).toEqual(['Jazz']);
  });

  it('removes a pill with × and the last one with Backspace', () => {
    render(<Harness initial={['Jazz', 'Soul', 'Funk']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Soul' }));
    expect(tags()).toEqual(['Jazz', 'Funk']);
    fireEvent.keyDown(screen.getByLabelText('Genres'), { key: 'Backspace' });
    expect(tags()).toEqual(['Jazz']);
  });
});
