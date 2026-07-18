const STEAM_ID64_OFFSET = 76_561_197_960_265_728n;
const MAX_DOTA_ACCOUNT_ID = 4_294_967_295n;
const STEAM_ID64_PATTERN = /^[0-9]{16,20}$/;

export class InvalidSteamIdError extends Error {
  constructor() {
    super('Введите корректный SteamID64');
    this.name = 'InvalidSteamIdError';
  }
}

export function steamId64ToAccountId(steamId64: string): number {
  const normalized = steamId64.trim();

  if (!STEAM_ID64_PATTERN.test(normalized)) {
    throw new InvalidSteamIdError();
  }

  const accountId = BigInt(normalized) - STEAM_ID64_OFFSET;
  if (accountId < 0n || accountId > MAX_DOTA_ACCOUNT_ID) {
    throw new InvalidSteamIdError();
  }

  return Number(accountId);
}

export function parseDotaAccountId(value: string): number {
  if (!/^[0-9]{1,10}$/.test(value)) {
    throw new InvalidSteamIdError();
  }

  const accountId = BigInt(value);
  if (accountId > MAX_DOTA_ACCOUNT_ID) {
    throw new InvalidSteamIdError();
  }

  return Number(accountId);
}
