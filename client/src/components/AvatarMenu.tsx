import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { initials } from '../theme/initials';

export interface AvatarUser {
  displayName: string;
  role: 'collector' | 'store_manager';
}

export default function AvatarMenu({ user }: { user: AvatarUser | null }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) {
    return (
      <Link to="/login" className="avatar-slot">
        Log in
      </Link>
    );
  }

  const close = () => setOpen(false);
  return (
    <div className="avatar-menu" ref={root}>
      <button
        type="button"
        className="avatar"
        aria-label={`Account menu for ${user.displayName}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {initials(...user.displayName.split(/\s+/))}
      </button>
      {open && (
        <nav id={menuId} className="avatar-dropdown" aria-label="Account">
          <Link to="/profile" onClick={close}>
            Profile &amp; preferences
          </Link>
          {user.role === 'store_manager' && (
            <Link to="/merchant" onClick={close}>
              Merchant dashboard
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
