import { useEffect } from 'react';

/** Full-screen in-app viewer for the static pages (/guide/, /notes/). Avoids navigating a home-screen app away from itself. */
export function DocViewer({ title, src, onClose }: { title: string; src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="docviewer">
      <div className="docviewer-bar">
        <b>{title}</b>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <div className="docviewer-body"><iframe title={title} src={src} /></div>
    </div>
  );
}
