import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props<T> {
  items: T[];
  rowHeight: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  label: string;
  overscan?: number;
}

/** Window-scrolled list that only mounts the rows near the viewport. */
export default function VirtualList<T>({
  items,
  rowHeight,
  getKey,
  renderItem,
  label,
  overscan = 8,
}: Props<T>) {
  const ref = useRef<HTMLUListElement>(null);
  const [range, setRange] = useState({ start: 0, end: 30 });

  useEffect(() => {
    const update = () => {
      const top = ref.current?.getBoundingClientRect().top ?? 0;
      const viewport = window.innerHeight || 800;
      const start = Math.max(0, Math.floor(-top / rowHeight) - overscan);
      const end = Math.min(items.length, Math.ceil((viewport - top) / rowHeight) + overscan);
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [items.length, rowHeight, overscan]);

  const visible = items.slice(range.start, Math.max(range.end, range.start));
  return (
    <ul
      ref={ref}
      className="virtual-list"
      aria-label={label}
      style={{ height: items.length * rowHeight }}
    >
      {visible.map((item, i) => (
        <li
          key={getKey(item)}
          style={{ top: (range.start + i) * rowHeight, height: rowHeight }}
          aria-setsize={items.length}
          aria-posinset={range.start + i + 1}
        >
          {renderItem(item)}
        </li>
      ))}
    </ul>
  );
}
