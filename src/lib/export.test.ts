import { describe, it, expect } from 'vitest';
import { entriesToCsv } from './export';
import { fromNYLocal } from './time';
import type { Entry } from '../types';

describe('entriesToCsv', () => {
  it('writes one row per entry, oldest first, with quoted notes', () => {
    const at = fromNYLocal(2026, 9, 12, 23, 50);
    const entries: Entry[] = [
      { id: 'b', type: 'diaper', at: at + 60_000, day: '2026-09-12', created_at: 0, updated_at: 0, logged_by: 'mom', wet: true, dirty: true, stool_color: 'yellow' },
      { id: 'a', type: 'feed', at, day: '2026-09-12', created_at: 0, updated_at: 0, logged_by: 'dad', kind: 'bottle_formula', volume_ml: 45, notes: 'spit up, "a lot"' },
    ];
    const lines = entriesToCsv(entries).trim().split('\n');
    expect(lines[0].startsWith('id,type,date,time,day,logged_by')).toBe(true);
    expect(lines[1]).toContain('a,feed,2026-09-12,11:50 PM,2026-09-12,dad,bottle_formula,,,45,1.52,');
    expect(lines[1]).toContain('"spit up, ""a lot"""');
    expect(lines[2]).toContain('b,diaper');
    expect(lines[2]).toContain('yes,yes,yellow');
  });
});
