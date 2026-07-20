import React, { createContext, useContext, useState } from 'react';

export const translations = {
  en: {
    // Header & Shell
    homeAriaLabel: 'Dota MatchLab, home',
    pageNotFound: 'Page not found.',
    authNotConfigured: 'Authentication is not configured for this environment.',
    authRequired: 'Authentication Required',
    authRequiredDesc: 'Sign in to unlock match importing by ID and track your stats. Viewing previously loaded analysis is available without signing in on the home page.',
    signInBtn: 'Sign in',
    signInToArchive: 'Sign in to Archive',
    myArchive: 'My Archive',
    demo: 'Demo',

    // LandingPage
    step01Title: 'Find',
    step01Text: 'Enter match ID and open an already parsed match analysis without registration.',
    step02Title: 'Analyze',
    step02Text: 'Examine teams, tempo, economy, abilities, and key events.',
    step03Title: 'Build Archive',
    step03Text: 'Sign in to link your profile and track match series over time.',
    invalidMatchIdInput: 'Please enter a valid numeric match ID.',
    heroTitlePart1: 'Parse every match ',
    heroTitlePart2: 'down to the last timing.',
    heroLede: 'Scoreboard, tempo, builds, and match events in a single technical report. Already loaded matches are available without registration.',
    openMatchByIdAriaLabel: 'Open match by ID',
    openAnalysisBtn: 'Open Analysis',
    newMatchHintAfterSignIn: '// New matches can be loaded after signing in.',
    workflowHeader: 'From Match ID to Analysis',

    // AccessPanel
    accessHeading: 'Access Control',
    setupTitle: 'Framework is ready',
    setupDesc: 'Add Clerk and Supabase keys to .env.local and .dev.vars to enable sign in.',
    accessCopy: 'Access is limited to beta test participants. Matches and state are protected by RLS rules.',
    signInToLab: 'Sign in to Lab',
    checkingRls: 'Checking RLS...',
    checkDataAccess: 'Check database access',
    rlsQuerySuccess: 'RLS request succeeded',
    accessApproved: 'Access Approved',

    // SystemStatus
    statusOnline: 'online',
    statusError: 'error',
    statusNotConfigured: 'not configured',
    statusChecking: 'checking',
    diagnosticHeading: 'System Diagnostics',
    diagnosticRetry: 'Retry Diagnostics',
    diagnosticChecking: 'Checking...',

    // ArchiveShowcase
    loadingPublicArchive: 'Loading public archive...',
    publicArchiveAriaLabel: 'Public player archive',
    openingPublicArchive: 'Opening public archive...',
    publicArchiveNotFound: 'Public archive not found.',

    // ArchiveSyncPanel
    syncMatchesHeading: 'Gather Match History',
    syncMatchesDesc: 'History is loaded in batches of up to 500 matches for {accountName}. Match details are loaded manually from the selected match.',
    parsingAllHistory: 'Parsing history...',
    parseAllBtn: 'Parse all',
    syncingBtn: 'Syncing...',
    loadOneBatchBtn: 'Load one batch',
    progressBatches: 'Batches:',
    progressFetched: 'fetched:',
    progressOffset: 'offset:',
    historyInArchive: 'Archived:',
    historyEndReached: ' reached the end of available history',
    historyNextAvailable: ' next page is available',
    historyNotStarted: ' sync has not started yet',
    historyUpdated: ' updated {date}',

    // MatchDetailView & MatchRoute
    backToArchive: 'Back to archive',
    backToHome: 'Back to home',
    backToPublicArchive: 'Back to public archive',
    loadingMatch: 'Analyzing match...',
    matchNotFound: 'Match not found.',
    invalidMatchId: 'Invalid match ID in URL.',
    parseDisabledReason: 'Sign in to load missing data.',
    matchUnavailable: 'Match is unavailable on STRATZ.',
    matchNotLoaded: 'Match has not been loaded yet.',
    loadingMatchDetails: 'Loading...',
    loadMatchFromStratz: 'Load match from STRATZ',
    signInToLoadMatch: 'Sign in to load match',

    // PlayerDashboard
    loadingPersonalArchive: 'Loading personal archive from Supabase...',
    profileNotSelected: 'No player profile selected.',
    matchesTitle: 'Matches',
    archiveNoOverview: 'Archive does not contain any available analytics yet.',
    refreshArchiveAriaLabel: 'Refresh archive',
    loadingMatchesList: 'Loading match history...',
    noMatchesForFilters: 'No matches matched selected filters.',
    matchArchiveAriaLabel: 'Match Archive',
    resetHeroFilterAriaLabel: 'Reset hero filter',
    recentFormAriaLabel: 'Recent Form / Last 20',
    recentFormTooltipWin: 'Win',
    recentFormTooltipLoss: 'Loss',
    recentFormTooltipUnknown: 'Unknown',
    openMatchAriaLabel: 'Open match {matchId}',
    rankUncalibrated: 'Rank uncalibrated',
    rankPrefix: 'Rank',
    indexedSuffix: ' indexed',
    durationSuffix: ' min average match',
    winsInView: ' wins in current view',
    noDataYet: 'No data yet',
    personalArchive: 'Personal match archive',
    publicShowcase: 'Public read-only showcase',
    filterSignal: 'FILTER THE SIGNAL',
    matchesInView: '{count} matches in view',
    noSignal: 'No signal',
    games_one: '{count} game',
    games_other: '{count} games',
    missingStatsSuffix: ' · Missing player stats',
    allResults: 'All results',
    winsOnly: 'Wins only',
    lossesOnly: 'Losses only',
    soloOrParty: 'Solo / Party',
    soloOnly: 'Solo only',
    partyOnly: 'Party only',
    allHeroes: 'All heroes',
    minGamesLabel: 'Min games:',
    breakdownModes: 'BREAKDOWN / MODES',
    whereWinsComeFrom: 'Where the wins come from',
    queueTempo: 'QUEUE / TEMPO',
    heroPoolRepeatSignal: 'HERO POOL / REPEAT SIGNAL',
    mostPlayed: 'Most played',
    highestWinRate: 'Highest win rate',
    highestLossRate: 'Highest loss rate',
    topPlayedTab: 'Top played',
    winRateTab: 'Win rate',
    lossRateTab: 'Loss rate',
    minGamesAriaLabel: 'Show heroes with at least {count} games',
    positionLane: 'POSITION / LANE',
    roleRecord: 'Role record',
    tableNotePrevious: 'Previous',
    tableNoteNext: 'Next',
    indexedMatchesLabel: 'Indexed matches',
    averageKdaLabel: 'Average KDA',
    tempoEconomyLabel: 'Tempo / economy',
    aboveEven: 'Above even',
    belowEven: 'Below even',
    even: 'Even',
    otherMode: 'Other mode',
    filterByHero: 'Filter by {hero}',
    recentFormTitle: 'The signal is still moving',
    completeLabel: 'complete',
    missingStatsLabel: 'missing stats',
    missingMatchLabel: 'missing match',
    unknownHero: 'Unknown hero',
    filterModeLabel: 'Mode',
    filterPositionLabel: 'Position',
    filterResultLabel: 'Result',
    filterQueueLabel: 'Queue',
    filterHeroLabel: 'Hero',
    unknownHeroLabel: 'Hero',
    playerDossierTitle: 'PLAYER DOSSIER / ARCHIVE',
    minGamesSuffix_one: '{count}+',
    minGamesSuffix_other: '{count}+',

    // MatchWorkspace / Account details
    publicArchiveUnavailable: 'This public archive is unavailable.',
    playerProfileTitle: 'Player Profile',
    vanitySteamLabel: 'Steam Profile',
    addProfileBtn: 'Add Profile',
    vanitySteamHint: 'Steam link, vanity name or SteamID64.',
    loadingProfilesMsg: 'Loading profiles...',
    addSteamHintMsg: 'Add a Steam profile link to build your personal archive.',
    trackedProfilesAriaLabel: 'Tracked Profiles',
    unknownPlayerName: 'Unknown Player',
    removeProfileTitle: 'Remove profile from list',
    removeProfileConfirm: 'Are you sure you want to remove the profile "{name}" from the list?',
    removeProfileAriaLabel: 'Remove profile {name} from list',

    // MatchInsightsPanel & details
    insightChat: 'Global chat and chat-wheel events',
    insightTowers: 'Tower destruction events',
    insightRunes: 'Global rune collections',
    insightWards: 'Global warding and dewarding events',
    insightBuildings: 'Building status timeline',
    insightRoshan: 'Roshan events from match playback',
    advantageCurve: 'Advantage curve',
    openingMap: 'Opening map',
    economyTimeline: 'ECONOMY / TIMELINE',
    lanesOutcome: 'LANES / OUTCOME',
    matchEventsAllPlayers: 'MATCH EVENTS / ALL PLAYERS',

    // MatchDetailHeader
    headerPartialTitle: 'Partial Parse',
    headerPartialDesc: 'Saved data is already shown. Missing sections can be loaded, or you can retry full parsing.',
    headerBaseTitle: 'Base Parse',
    headerBaseDesc: 'Basic statistics are available. Load advanced parse for playback, abilities and details.',
    headerSource: 'Source:',
    headerRefresh: 'Refresh',
    headerLoadFullParse: 'Load Full Parse',
    headerLoadDetails: 'Loading details...',
    headerBaseData: 'Base Data',
    headerQueue: 'Queued',
    headerFullParse: 'Full Parse',
    headerDetailsUnavailable: 'Details Unavailable',
    headerFailed: 'Parse Error',

    // MatchChatPanel
    chatHide: 'Hide chat',
    chatShow: 'Show chat',
    chatWarning: 'Raw in-game chat may contain offensive language.',
    chatTextOnly: 'Text only',
    chatAll: 'All',
    chatAriaLabel: 'Match chat log',

    // Backend Error codes
    INVALID_JSON: 'Invalid JSON',
    STEAM_PROFILE_REQUIRED: 'Steam profile is required',
    INVALID_TRACKED_ACCOUNT_ID: 'Invalid tracked account ID',
    INVALID_MATCH_ID: 'Invalid match ID',
    INVALID_STEAM_ID: 'Please enter a valid SteamID64',
    STEAM_PROFILE_NOT_FOUND: 'Steam profile not found',
    STEAM_NO_ID_RETURNED: 'Steam did not return ID for the specified profile',
    STEAM_COMMUNITY_TIMEOUT: 'Steam Community did not respond in time',
    STEAM_COMMUNITY_CONN_ERROR: 'Failed to connect with Steam Community',
    STEAM_COMMUNITY_INPUT_INVALID: 'Please enter a SteamID64, vanity name, or Steam Community link',
    STEAM_COMMUNITY_HOSTS_INVALID: 'Only steamcommunity.com links are supported',
    STEAM_PROFILE_LINK_INVALID: 'Steam profile link is invalid',
    STEAM_ID_LINK_INVALID: 'SteamID64 in the link is invalid',
    STEAM_RESPONSE_TOO_LARGE: 'Steam response exceeds allowed size',
    OPENDOTA_PROFILE_HIDDEN: 'Profile not found or hidden by privacy settings',
    OPENDOTA_NO_PROFILE_NAME: 'OpenDota did not return profile name',
    OPENDOTA_UNEXPECTED_FORMAT: 'OpenDota returned unexpected data format',
    OPENDOTA_INVALID_OFFSET: 'Invalid match history offset',
    OPENDOTA_INVALID_LIMIT: 'Invalid match history page size',
    OPENDOTA_INVALID_HISTORY: 'OpenDota returned unexpected history format',
    OPENDOTA_URL_MISCONFIGURED: 'OpenDota URL is misconfigured',
    OPENDOTA_PROFILE_NOT_FOUND: 'OpenDota profile not found',
    OPENDOTA_LIMIT_EXCEEDED: 'OpenDota rate limit exceeded, please retry later',
    OPENDOTA_UNAVAILABLE: 'OpenDota is temporarily unavailable',
    OPENDOTA_RESPONSE_TOO_LARGE: 'OpenDota response exceeds allowed size',
    OPENDOTA_TIMEOUT: 'OpenDota did not respond in time',
    OPENDOTA_CONN_ERROR: 'Failed to connect to OpenDota',
    OPENDOTA_HEROES_UNEXPECTED: 'OpenDota returned unexpected heroes format',
    STRATZ_OFFSET_INVALID: 'Invalid STRATZ match history offset',
    STRATZ_LIMIT_INVALID: 'Invalid STRATZ match history page size',
    STRATZ_UNEXPECTED_FORMAT: 'STRATZ returned unexpected match history format',
    STRATZ_MATCH_ID_INVALID: 'Invalid STRATZ match ID',
    STRATZ_DETAIL_INVALID: 'STRATZ returned invalid match details',
    STRATZ_SECTION_FAILED: 'Failed to load STRATZ detail section',
    STRATZ_RESPONSE_TOO_LARGE: 'STRATZ response exceeds allowed size',
    STRATZ_CHALLENGE_OR_REJECTED: 'STRATZ rejected request or returned Cloudflare challenge',
    STRATZ_PLAYER_NOT_FOUND: 'STRATZ player not found',
    STRATZ_LIMIT_EXCEEDED: 'STRATZ rate limit exceeded, please retry later',
    STRATZ_UNAVAILABLE: 'STRATZ is temporarily unavailable',
    STRATZ_INVALID_JSON: 'STRATZ returned invalid JSON',
    STRATZ_UNEXPECTED_RESPONSE: 'STRATZ returned unexpected response',
    STRATZ_TIMEOUT: 'STRATZ did not respond in time',
    STRATZ_CONN_ERROR: 'Failed to connect to STRATZ',
    STRATZ_GRAPHQL_ERROR: 'STRATZ GraphQL returned error',
    MATCH_ARCHIVE_NOT_CONFIGURED: 'Match archive is not configured on Worker',
    MATCH_ARCHIVE_SYNC_INITIATION_FAILED: 'Failed to initiate archive synchronization',
    MATCH_ARCHIVE_ACCOUNT_NOT_FOUND: 'Tracked account not found',
    MATCH_ARCHIVE_SYNC_SUSPENDED: 'Synchronization is temporarily suspended due to provider error',
    MATCH_ARCHIVE_SYNC_IN_PROGRESS: 'Synchronization for this account is already in progress',
    MATCH_ARCHIVE_SAVE_PAGE_FAILED: 'Failed to save archive page',
    MATCH_ARCHIVE_SYNC_FAILED: 'Failed to synchronize match archive',
    MATCH_ARCHIVE_INVALID_FIELD: 'Archive returned invalid field {fieldName}',
    MATCH_ARCHIVE_INVALID_STATUS: 'Archive returned invalid status',
    MATCH_ARCHIVE_UNKNOWN_ERROR: 'Unknown synchronization error',
    MATCH_DETAIL_ARCHIVE_INVALID_ID: 'Invalid match ID',
    MATCH_DETAIL_ARCHIVE_FETCH_FAILED: 'Failed to retrieve selected match details',
    MATCH_DETAIL_ARCHIVE_SAVE_FAILED: 'Failed to save match',
    MATCH_DETAIL_ARCHIVE_NOT_FOUND: 'Tracked match not found',
    MATCH_DETAIL_ARCHIVE_DETAILS_SAVE_FAILED: 'Failed to save match details',
    MATCH_DETAIL_ARCHIVE_QUEUE_INVALID_IDS: 'STRATZ details queue returned invalid match IDs',
  }
} as const;

export type Locale = 'en' | 'ru';
type PluralBaseKeys<T> = T extends `${infer Base}_${'one' | 'few' | 'many' | 'other'}` ? Base : never;
export type TranslationKey = keyof typeof translations.en | PluralBaseKeys<keyof typeof translations.en>;

export function getPluralSuffix(locale: Locale, n: number): 'one' | 'few' | 'many' | 'other' {
  if (locale === 'ru') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
    return 'many';
  }
  return n === 1 ? 'one' : 'other';
}

export function translate(
  locale: Locale,
  key: string,
  replacements?: Record<string, string | number>,
): string {
  let resolvedKey = key;
  if (replacements && 'count' in replacements) {
    const count = Number(replacements.count);
    const suffix = getPluralSuffix(locale, count);
    const pluralKey = `${key}_${suffix}`;
    const localeDict = (translations as Record<string, Record<string, string> | undefined>)[locale];
    const enDict = translations['en'] as Record<string, string>;

    if ((localeDict && pluralKey in localeDict) || pluralKey in enDict) {
      resolvedKey = pluralKey;
    } else if (suffix !== 'other') {
      const otherKey = `${key}_other`;
      if ((localeDict && otherKey in localeDict) || otherKey in enDict) {
        resolvedKey = otherKey;
      }
    }
  }

  const localeDict = (translations as Record<string, Record<string, string> | undefined>)[locale];
  const enDict = translations['en'] as Record<string, string>;
  let val = localeDict ? localeDict[resolvedKey] : undefined;
  if (!val) {
    val = enDict[resolvedKey];
  }
  if (!val) {
    return String(resolvedKey);
  }
  if (replacements) {
    val = val.replace(/\{(\w+)\}/g, (_, k) => String(replacements[k] ?? ''));
  }
  return val;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  const t = (key: TranslationKey, replacements?: Record<string, string | number>): string => {
    return translate(locale, key, replacements);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    const isTest = typeof globalThis !== 'undefined' && (globalThis as unknown as Record<string, Record<string, Record<string, string>> | undefined>).process?.env?.NODE_ENV === 'test';
    if (!isTest) {
      console.warn('useTranslation was called outside of an I18nProvider. Falling back to English.');
    }
    const t = (key: TranslationKey, replacements?: Record<string, string | number>): string => {
      return translate('en', key, replacements);
    };
    return { locale: 'en' as Locale, setLocale: () => {}, t };
  }
  return context;
}
