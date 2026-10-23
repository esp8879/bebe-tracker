import { useRef, useState, type TouchEvent } from 'react';
import type { Entry } from '../types';
import { useStore } from '../data/store';
import { useUI } from '../ui';
import { describe } from '../lib/describe';
import { Icon } from './Icon';
import { fmtTime } from '../lib/time';

const REVEAL = 92; // px of red Delete revealed by a left swipe

export function EntryRow({ e }: { e: Entry }) {
  const { settings } = useStore();
  const { openEditor, deleteWithUndo } = useUI();
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const dxRef = useRef(0);
  const by = e.logged_by === 'dad' ? settings.users.dad : e.logged_by === 'mom' ? settings.users.mom : (settings.users.other || '');

  const onTouchStart = (ev: TouchEvent) => {
    const t = ev.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    moved.current = false;
  };
  const onTouchMove = (ev: TouchEvent) => {
    if (!start.current) return;
    const t = ev.touches[0];
    const ddx = t.clientX - start.current.x, ddy = t.clientY - start.current.y;
    if (!moved.current) {
      if (Math.abs(ddy) > Math.abs(ddx)) { start.current = null; return; } // vertical scroll wins
      if (Math.abs(ddx) < 8) return;
      moved.current = true;
      setDragging(true);
    }
    const base = open ? -REVEAL : 0;
    dxRef.current = Math.max(-REVEAL - 24, Math.min(0, base + ddx));
    setDx(dxRef.current);
  };
  const onTouchEnd = () => {
    if (moved.current) {
      setOpen(dxRef.current < -REVEAL / 2);
    }
    dxRef.current = 0;
    setDx(0);
    setDragging(false);
    start.current = null;
  };
  const onClick = () => {
    if (moved.current) { moved.current = false; return; }
    if (open) { setOpen(false); return; }
    openEditor(e.type, { entry: e });
  };
  const offset = dragging ? dx : open ? -REVEAL : 0;

  return (
    <div className="swipe">
      <button className="swipe-del" tabIndex={open ? 0 : -1} aria-hidden={!open} onClick={() => { setOpen(false); deleteWithUndo(e); }}>Delete</button>
      <button
        className="entry"
        style={{ transform: `translateX(${offset}px)`, transition: dragging ? 'none' : 'transform .18s ease-out' }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        onClick={onClick}
      >
        <span className={`ico t-${e.type}`}><Icon name={e.type} /></span>
        <span className="time mono">{fmtTime(e.at)}</span>
        <span className="desc">
          <div>{describe(e)}</div>
          {e.notes && <div className="notes">{e.notes}</div>}
        </span>
        {by && <span className="by">{by}</span>}
      </button>
    </div>
  );
}
