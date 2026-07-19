import { describe, expect, it } from 'vitest';
import { parseMatchId } from './match-id';

describe('parseMatchId', () => {
  it('normalizes a positive safe integer', () => {
    expect(parseMatchId(' 8749050591 ')).toBe(8_749_050_591);
  });

  it.each([null, '', '0', '-1', '1.5', 'match', '9007199254740992'])(
    'rejects %s',
    (value) => expect(parseMatchId(value)).toBeNull(),
  );
});
