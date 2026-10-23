import { useState } from 'react';
import { useStore } from '../data/store';
import { shareUrl } from '../household';
import { Field, Chips } from './common';
import type { Who } from '../types';

/** One-time setup after creating a household. Everything here can be changed later in Settings. */
export function Setup({ onDone }: { onDone: () => void }) {
  const { settings, saveSettings, setWho, hid } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.baby_name === 'Baby' ? '' : settings.baby_name);
  const [dob, setDob] = useState(settings.dob);
  const [who, setWhoLocal] = useState<Who | null>(null);
  const [interval, setInterval_] = useState(String(settings.feed_interval_min));
  const [copied, setCopied] = useState(false);
  const url = shareUrl(hid);
  const total = 4;

  const next = () => setStep((s) => s + 1);
  const finishBaby = () => { void saveSettings({ baby_name: name.trim() || 'Baby', dob: dob || settings.dob }); next(); };
  const finishWho = (w: Who) => { setWhoLocal(w); setWho(w); next(); };
  const finishInterval = () => { void saveSettings({ feed_interval_min: +interval }); next(); };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'bébé tracker', text: 'Our baby log. Open this on your phone, then add it to your home screen.', url }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* ignore */ } }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } };

  return (
    <div className="overlay" style={{ justifyContent: 'flex-start', paddingTop: 48, gap: 18 }}>
      <div className="muted small" style={{ alignSelf: 'stretch', maxWidth: 420, width: '100%', margin: '0 auto' }}>Step {step + 1} of {total} · <button className="btn ghost" style={{ minHeight: 0, padding: 0, fontSize: 14 }} onClick={onDone}>Skip setup</button></div>
      <div className="stack" style={{ width: '100%', maxWidth: 420, gap: 16 }}>
        {step === 0 && (
          <>
            <h1>Who are we logging?</h1>
            <Field label="Baby's name (or a nickname for now)"><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Baby" autoFocus /></Field>
            <Field label="Date and time of birth"><input type="datetime-local" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
            <div className="muted small">Age and "day of life" on the home screen come from this. Change it any time in Settings.</div>
            <button className="btn primary xl" onClick={finishBaby}>Next</button>
          </>
        )}
        {step === 1 && (
          <>
            <h1>Who's holding this phone?</h1>
            <div className="muted small">Entries you log get tagged with this. Your partner picks the other one on their phone.</div>
            <button className="btn xl primary" onClick={() => finishWho('dad')}>Dad</button>
            <button className="btn xl" onClick={() => finishWho('mom')}>Mom</button>
            <button className="btn" onClick={() => finishWho('other')}>Someone else (grandparent, nanny…)</button>
            <div className="muted small">Names and roles can be changed in Settings.</div>
          </>
        )}
        {step === 2 && (
          <>
            <h1>How often do feeds come around?</h1>
            <div className="muted small">The home screen counts down from the last feed to the next one. Pick what your pediatrician or the hospital told you. Change it any time.</div>
            <Chips big options={[{ value: '120', label: 'Every 2h' }, { value: '150', label: '2½h' }, { value: '180', label: '3h' }, { value: '210', label: '3½h' }, { value: '240', label: '4h' }]} value={interval} onChange={setInterval_} />
            <div className="muted small">Med countdowns for mom (Tylenol, Ibuprofen, Lovenox…) are set in Settings once you have the discharge sheet.</div>
            <button className="btn primary xl" onClick={finishInterval}>Next</button>
          </>
        )}
        {step === 3 && (
          <>
            <h1>Get it on both phones</h1>
            <div className="card">
              <b>1. Send your partner this link</b>
              <div className="muted small">It <b>is</b> the key to your log, so only share it with each other.</div>
              <div className="link-box">{url}</div>
              <div className="actions" style={{ display: 'flex', gap: 10 }}>
                <button className="btn primary grow" onClick={share}>Share link</button>
                <button className="btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
            <div className="card">
              <b>2. Add to Home Screen, on each phone</b>
              <div className="muted small">iPhone: open the link in Safari, tap Share, then <b>Add to Home Screen</b>. Android: Chrome menu, then <b>Add to Home screen</b>. It launches full screen like an app and works offline.</div>
            </div>
            <button className="btn primary xl" onClick={onDone}>{who ? 'Start logging' : 'Done'}</button>
          </>
        )}
      </div>
    </div>
  );
}
