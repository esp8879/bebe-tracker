import { createContext, useContext, useEffect, useState } from 'react';
import { applyUpdate, updateReady } from './sw';
import { StoreProvider, useStore } from './data/store';
import { DemoStoreProvider } from './data/demoStore';
import { DEMO_HID, DEMO_PATH } from './data/demo';
import { openSleep } from './lib/sleep';
import { fmtDur, fmtTime } from './lib/time';
import { resolveHid, createHousehold, joinHousehold } from './household';
import { UIProvider, useUI } from './ui';
import { Editor } from './components/editors';
import { Today } from './screens/Today';
import { Summary } from './screens/Summary';
import { Settings } from './screens/Settings';
import { Appointments } from './screens/Appointments';
import { ApptEditor } from './components/ApptEditor';
import { Weight } from './screens/Weight';
import { WeightEditor } from './components/WeightEditor';
import { Setup } from './components/Setup';
import { DocViewer } from './components/DocViewer';
import type { Who } from './types';
import { Icon, Mark, type IconName } from './components/Icon';

export type Tab = 'today' | 'summary' | 'weight' | 'appointments' | 'settings';
const NavCtx = createContext<{ tab: Tab; setTab: (t: Tab) => void }>({ tab: 'today', setTab: () => undefined });
export const useNav = () => useContext(NavCtx);
const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' }, { id: 'summary', label: 'Summary' }, { id: 'weight', label: 'Weight' },
  { id: 'appointments', label: 'Appts' }, { id: 'settings', label: 'Settings' },
];

function WhoPicker({ onPick, names }: { onPick: (w: Who) => void; names: { dad: string; mom: string; other?: string } }) {
  return (
    <div className="overlay">
      <h1>Who's using this phone?</h1>
      <div className="muted center">Entries you log will be tagged with this name. You can change it in Settings.</div>
      <div className="stack" style={{ width: '100%', maxWidth: 360 }}>
        <button className="btn xl primary" onClick={() => onPick('dad')}>{names.dad}</button>
        <button className="btn xl" onClick={() => onPick('mom')}>{names.mom}</button>
        <button className="btn xl" onClick={() => onPick('other')}>{names.other || 'Someone else'}</button>
      </div>
    </div>
  );
}

function UpdateBar() {
  const [ready, setReady] = useState(updateReady);
  useEffect(() => { const on = () => setReady(true); window.addEventListener('bebe:update', on); return () => window.removeEventListener('bebe:update', on); }, []);
  if (!ready) return null;
  return (
    <div className="update-scrim" role="dialog" aria-label="Update available">
      <div className="update-card">
        <h2>A new version is ready</h2>
        <div className="muted">Update to get the latest version of bébé tracker</div>
        <button className="btn primary xl" onClick={() => void applyUpdate(true)}>Update now</button>
      </div>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>('today');
  // Each tab opens at the top; otherwise a long tab's scroll carries over and tucks the next one under the status bar.
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  const { editor, apptEditor, weightEditor, openEditor, toast } = useUI();
  const { settings: tracked, entries, update } = useStore();
  const asleep = tracked.sleep_enabled !== false ? openSleep(entries) : null;
  const wokeUp = () => {
    if (!asleep) return;
    const at = Date.now();
    void update(asleep.id, { end_at: at });
    toast(`Woke up at ${fmtTime(at)} after ${fmtDur(at - asleep.at)}`, () => { void update(asleep.id, { end_at: null }); });
  };
  // Switched-off types leave the dock; the rest keep their order so positions stay familiar.
  const dock = [
    { key: 'feed', label: 'Feed', on: true, act: () => openEditor('feed') },
    { key: 'sleep', label: asleep ? 'Woke up' : 'Sleep', on: tracked.sleep_enabled !== false, act: () => (asleep ? wokeUp() : openEditor('sleep')) },
    { key: 'diaper', label: 'Diaper', on: tracked.diapers_enabled !== false, act: () => openEditor('diaper') },
    { key: 'pump', label: 'Pump', on: true, act: () => openEditor('pump') },
    { key: 'mom_med', label: 'Meds', on: tracked.meds_enabled !== false, act: () => openEditor('mom_med') },
  ].filter((d) => d.on);
  return (
    <NavCtx.Provider value={{ tab, setTab }}>
    <div className="app">
      {tab === 'today' && <Today />}
      {tab === 'summary' && <Summary />}
      {tab === 'weight' && <Weight />}
      {tab === 'appointments' && <Appointments />}
      {tab === 'settings' && <Settings />}
      {tab === 'today' && (
        <div className="dock"><div style={{ gridTemplateColumns: `repeat(${dock.length}, 1fr)` }}>
          {dock.map((d) => (
            <button key={d.key} className={d.key === 'sleep' && asleep ? 'asleep' : ''} onClick={d.act}>
              <span className={`ico t-${d.key}`}><Icon name={d.key as IconName} /></span>{d.label}
            </button>
          ))}
        </div></div>
      )}
      <nav className="tabbar"><div>
        {TABS.map((t) => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}><span className="ico"><Icon name={t.id as IconName} size={22} filled={tab === t.id} /></span>{t.label}</button>)}
      </div></nav>
      <UpdateBar />
      {editor && <Editor state={editor} />}
      {apptEditor && <ApptEditor appt={apptEditor.appt} />}
      {weightEditor && <WeightEditor weight={weightEditor.weight} />}
    </div>
    </NavCtx.Provider>
  );
}

function Welcome({ onCreate }: { onCreate: () => void }) {
  const [joining, setJoining] = useState(false);
  const [guide, setGuide] = useState(false);
  const [link, setLink] = useState('');
  const [bad, setBad] = useState(false);
  return (
    <div className="overlay welcome" style={{ justifyContent: 'flex-start', paddingTop: 56, gap: 22 }}>
      <div className="stack" style={{ width: '100%', maxWidth: 420, gap: 14 }}>
        <Mark size={72} />
        <h1 className="wordmark">bébé <span>tracker</span></h1>
        <div className="muted" style={{ fontSize: 18 }}>A shared newborn logbook for two phones. Feeds, diapers, pumping, mom's meds, weight and appointments, in sync, built for one hand at 3 am.</div>
      </div>
      <div className="stack" style={{ width: '100%', maxWidth: 420, gap: 10 }}>
        <button className="btn xl primary" onClick={onCreate}>Start your household</button>
        {!joining ? (
          <button className="btn ghost" onClick={() => setJoining(true)}>I have a family link already</button>
        ) : (
          <div className="card">
            <div className="muted small">Paste the link your partner sent. This phone joins that household and sees everything already logged.</div>
            <input type="text" inputMode="url" placeholder="https://bebe.fyi/h/…" value={link} onChange={(e) => { setLink(e.target.value); setBad(false); }} autoFocus />
            {bad && <div className="red small">That doesn't look like a family link.</div>}
            <button className="btn primary" disabled={!link.trim()} onClick={() => { if (!joinHousehold(link)) setBad(true); }}>Join household</button>
          </div>
        )}
        {guide && <DocViewer title="Guide" src="/guide/" onClose={() => setGuide(false)} />}
        <a className="btn block" href={DEMO_PATH} style={{ textDecoration: 'none' }}>Look around a demo first</a>
        <div className="muted small center">Free, no accounts, no ads. <button className="btn ghost" style={{ minHeight: 0, padding: 0, fontSize: 14 }} onClick={() => setGuide(true)}>Read the guide</button></div>
      </div>
    </div>
  );
}

function Gate({ setup, onSetupDone }: { setup: boolean; onSetupDone: () => void }) {
  const { who, setWho, settings } = useStore();
  if (setup) return <Setup onDone={onSetupDone} />;
  if (!who) return <WhoPicker onPick={setWho} names={settings.users} />;
  return <UIProvider><Shell /></UIProvider>;
}

export default function App() {
  const [hid, setHid] = useState<string | null>(resolveHid);
  const [setup, setSetup] = useState(false);
  if (!hid) return <Welcome onCreate={() => { setHid(createHousehold()); setSetup(true); }} />;
  if (hid === DEMO_HID) return <DemoStoreProvider><Gate setup={false} onSetupDone={() => {}} /></DemoStoreProvider>;
  return <StoreProvider hid={hid}><Gate setup={setup} onSetupDone={() => setSetup(false)} /></StoreProvider>;
}
