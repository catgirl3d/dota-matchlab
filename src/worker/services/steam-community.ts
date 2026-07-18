import { InvalidSteamIdError, steamId64ToAccountId } from './steam-id';

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

  constructor(message: string, statusCode: 400 | 404 | 502 | 504) {
    super(message);
    this.name = 'SteamCommunityError';
    this.statusCode = statusCode;
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

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetcher(endpoint, {
      headers: {
        Accept: 'application/xml,text/xml',
        'User-Agent': 'DotaMatchLab/0.1',
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new SteamCommunityError('Steam-профиль не найден', 404);
    }

    const xml = await readBoundedText(response, MAX_XML_BYTES);
    const steamId64 = /<steamID64>([0-9]{16,20})<\/steamID64>/.exec(xml)?.[1];
    if (!steamId64) {
      throw new SteamCommunityError(
        'Steam не вернул ID для указанного профиля',
        404,
      );
    }

    steamId64ToAccountId(steamId64);
    return steamId64;
  } catch (error) {
    if (error instanceof SteamCommunityError) {
      throw error;
    }
    if (abortController.signal.aborted) {
      throw new SteamCommunityError('Steam Community не ответил вовремя', 504);
    }

    throw new SteamCommunityError('Не удалось связаться со Steam Community', 502);
  } finally {
    clearTimeout(timeout);
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
      'Введите SteamID64, vanity name или ссылку Steam Community',
      400,
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
      'Поддерживаются только ссылки steamcommunity.com',
      400,
    );
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw new SteamCommunityError('Ссылка Steam-профиля некорректна', 400);
  }

  const [kind, rawValue] = segments;
  const value = decodeURIComponent(rawValue);
  if (kind.toLowerCase() === 'profiles') {
    try {
      steamId64ToAccountId(value);
    } catch (error) {
      if (error instanceof InvalidSteamIdError) {
        throw new SteamCommunityError('SteamID64 в ссылке некорректен', 400);
      }
      throw error;
    }
    return { type: 'steam-id', value };
  }

  if (kind.toLowerCase() === 'id' && VANITY_PATTERN.test(value)) {
    return { type: 'vanity', value };
  }

  throw new SteamCommunityError('Ссылка Steam-профиля некорректна', 400);
}

async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > maxBytes) {
    await response.body?.cancel();
    throw new SteamCommunityError('Ответ Steam превышает допустимый размер', 502);
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new SteamCommunityError('Ответ Steam превышает допустимый размер', 502);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}
