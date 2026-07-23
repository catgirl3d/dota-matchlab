import { InvalidSteamIdError, steamId64ToAccountId } from './steam-id';
import {
  RequestTimeoutError,
  ResponseBodyTooLargeError,
  readBoundedText,
  withTimeout,
} from '../../shared/http';

const STEAM_COMMUNITY_HOSTS = new Set([
  'steamcommunity.com',
  'www.steamcommunity.com',
]);
const VANITY_PATTERN = /^[a-zA-Z0-9_-]{2,64}$/;
const MAX_XML_BYTES = 64_000;
const REQUEST_TIMEOUT_MS = 6_000;

type SteamProfileReference =
  | { type: 'steam-id'; value: string }
  | { type: 'vanity'; value: string };

export class SteamCommunityError extends Error {
  readonly statusCode: 400 | 404 | 502 | 504;
  readonly code: string;

  constructor(message: string, statusCode: 400 | 404 | 502 | 504, code: string) {
    super(message);
    this.name = 'SteamCommunityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function resolveSteamProfileInput(
  input: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const reference = parseSteamProfileInput(input);
  if (reference.type === 'steam-id') {
    return reference.value;
  }

  const endpoint = new URL(
    `/id/${encodeURIComponent(reference.value)}`,
    'https://steamcommunity.com',
  );
  endpoint.searchParams.set('xml', '1');

  try {
    return await withTimeout(REQUEST_TIMEOUT_MS, async (signal) => {
      const response = await fetcher(endpoint, {
        headers: {
          Accept: 'application/xml,text/xml',
          'User-Agent': 'DotaMatchLab/0.1',
        },
        signal,
      });

      if (!response.ok) {
        await response.body?.cancel();
        throw new SteamCommunityError('Steam profile not found', 404, 'STEAM_PROFILE_NOT_FOUND');
      }

      const xml = await readBoundedText(response, MAX_XML_BYTES);
      const steamId64 = /<steamID64>([0-9]{16,20})<\/steamID64>/.exec(xml)?.[1];
      if (!steamId64) {
        throw new SteamCommunityError(
          'Steam did not return ID for the specified profile',
          404,
          'STEAM_NO_ID_RETURNED',
        );
      }

      steamId64ToAccountId(steamId64);
      return steamId64;
    });
  } catch (error) {
    if (error instanceof SteamCommunityError) {
      throw error;
    }
    if (error instanceof ResponseBodyTooLargeError) {
      throw new SteamCommunityError('Steam response exceeds allowed size', 502, 'STEAM_RESPONSE_TOO_LARGE');
    }
    if (error instanceof RequestTimeoutError) {
      throw new SteamCommunityError('Steam Community did not respond in time', 504, 'STEAM_COMMUNITY_TIMEOUT');
    }

    throw new SteamCommunityError('Failed to connect with Steam Community', 502, 'STEAM_COMMUNITY_CONN_ERROR');
  }
}

export function parseSteamProfileInput(input: string): SteamProfileReference {
  const normalized = input.trim();

  if (/^[0-9]{16,20}$/.test(normalized)) {
    steamId64ToAccountId(normalized);
    return { type: 'steam-id', value: normalized };
  }

  if (VANITY_PATTERN.test(normalized)) {
    return { type: 'vanity', value: normalized };
  }

  const urlValue = /^steamcommunity\.com\//i.test(normalized)
    ? `https://${normalized}`
    : normalized;

  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new SteamCommunityError(
      'Please enter a SteamID64, vanity name, or Steam Community link',
      400,
      'STEAM_COMMUNITY_INPUT_INVALID',
    );
  }

  if (
    !STEAM_COMMUNITY_HOSTS.has(url.hostname.toLowerCase()) ||
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new SteamCommunityError(
      'Only steamcommunity.com links are supported',
      400,
      'STEAM_COMMUNITY_HOSTS_INVALID',
    );
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new SteamCommunityError('Steam profile link is invalid', 400, 'STEAM_PROFILE_LINK_INVALID');
  }

  const [kind, rawValue] = segments;
  const value = decodeURIComponent(rawValue);
  if (kind.toLowerCase() === 'profiles') {
    try {
      steamId64ToAccountId(value);
    } catch (error) {
      if (error instanceof InvalidSteamIdError) {
        throw new SteamCommunityError('SteamID64 in the link is invalid', 400, 'STEAM_ID_LINK_INVALID');
      }
      throw error;
    }
    return { type: 'steam-id', value };
  }

  if (kind.toLowerCase() === 'id' && VANITY_PATTERN.test(value)) {
    return { type: 'vanity', value };
  }

  throw new SteamCommunityError('Steam profile link is invalid', 400, 'STEAM_PROFILE_LINK_INVALID');
}

