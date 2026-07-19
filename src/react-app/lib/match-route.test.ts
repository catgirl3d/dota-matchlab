import { describe, expect, it } from 'vitest';
import { matchPath, parseMatchRoute } from './match-route';

describe('match URL routing', () => {
  it('parses direct deep links without initiating an import', () => {
    expect(parseMatchRoute('/matches/8749050591')).toEqual({ kind: 'match', matchId: 8_749_050_591 });
  });
  it('rejects invalid match paths', () => {
    expect(parseMatchRoute('/matches/0')).toEqual({ kind: 'invalid-match' });
    expect(parseMatchRoute('/matches/not-a-match')).toEqual({ kind: 'invalid-match' });
  });
  it('keeps archive navigation URL-driven', () => {
    expect(matchPath(9001)).toBe('/matches/9001');
    expect(() => matchPath(0)).toThrow('Invalid match ID');
  });
});
