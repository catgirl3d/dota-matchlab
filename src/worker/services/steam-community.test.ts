import { describe, expect, it, vi } from 'vitest';
import {
  parseSteamProfileInput,
  resolveSteamProfileInput,
  SteamCommunityError,
} from './steam-community';

describe('Steam Community profile resolver', () => {
  it('accepts SteamID64, profile URLs and vanity names', () => {
    expect(parseSteamProfileInput('76561198115048758')).toEqual({
      type: 'steam-id',
      value: '76561198115048758',
    });
    expect(
      parseSteamProfileInput(
        'https://steamcommunity.com/profiles/76561198115048758/',
      ),
    ).toEqual({ type: 'steam-id', value: '76561198115048758' });
    expect(parseSteamProfileInput('https://steamcommunity.com/id/alina_f0xy')).toEqual(
      { type: 'vanity', value: 'alina_f0xy' },
    );
    expect(parseSteamProfileInput('alina_f0xy')).toEqual({
      type: 'vanity',
      value: 'alina_f0xy',
    });
  });

  it('rejects non-Steam URLs before making a request', async () => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      resolveSteamProfileInput('https://example.com/id/alina_f0xy', fetcher),
    ).rejects.toBeInstanceOf(SteamCommunityError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('resolves a vanity profile through bounded Steam XML', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        '<?xml version="1.0"?><profile><steamID64>76561198115048758</steamID64></profile>',
        { headers: { 'Content-Type': 'text/xml' } },
      ),
    );

    await expect(resolveSteamProfileInput('alina_f0xy', fetcher)).resolves.toBe(
      '76561198115048758',
    );
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      'https://steamcommunity.com/id/alina_f0xy?xml=1',
    );
  });
  it('maps an oversized streamed response to a Steam provider error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(64_001));
          controller.close();
        },
      })),
    );

    await expect(resolveSteamProfileInput('alina_f0xy', fetcher)).rejects.toMatchObject({
      statusCode: 502,
      code: 'STEAM_RESPONSE_TOO_LARGE',
    });
  });

  it('maps an aborted request to a Steam timeout error', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn<typeof fetch>((_, init) => new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      }));
      const pending = resolveSteamProfileInput('alina_f0xy', fetcher);
      const assertion = expect(pending).rejects.toMatchObject({
        statusCode: 504,
        code: 'STEAM_COMMUNITY_TIMEOUT',
      });

      await vi.advanceTimersByTimeAsync(6_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
