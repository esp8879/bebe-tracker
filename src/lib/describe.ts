import { type Entry, feedKindLabel, medLabel, label } from '../types';
import { fmtMl } from './units';

export function describe(e: Entry): string {
  switch (e.type) {
    case 'feed': {
      if (e.kind === 'breast') {
        const bits = ['Breast'];
        if (e.side) bits.push(e.side === 'both' ? 'both sides' : e.side);
        if (e.duration_min != null) bits.push(`${e.duration_min} min`);
        if (e.latch_quality) bits.push(`latch ${e.latch_quality}`);
        return bits.join(' · ');
      }
      return `${feedKindLabel(e.kind)} · ${fmtMl(e.volume_ml)}`;
    }
    case 'diaper': {
      const what = e.wet && e.dirty ? 'Wet + dirty' : e.wet ? 'Wet' : e.dirty ? 'Dirty' : 'Diaper';
      const bits = [what];
      if (e.dirty && e.stool_color) bits.push(label(e.stool_color).toLowerCase());
      if (e.dirty && e.stool_amount) bits.push(e.stool_amount);
      return bits.join(' · ');
    }
    case 'pump': {
      const bits = ['Pump'];
      if (e.duration_min != null) bits.push(`${e.duration_min} min`);
      const vol = e.volume_ml ?? ((e.left_ml ?? 0) + (e.right_ml ?? 0) || undefined);
      if (vol != null) bits.push(fmtMl(vol));
      return bits.join(' · ');
    }
    case 'mom_med':
      return `${medLabel(e.med)}${e.dose_text ? ` · ${e.dose_text}` : ''}`;
  }
}
