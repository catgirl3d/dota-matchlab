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
    winsInView_one: '{formattedCount} win in current view',
    winsInView_other: '{formattedCount} wins in current view',
    noDataYet: 'No data yet',
    personalArchive: 'Personal match archive',
    publicShowcase: 'Public read-only showcase',
    filterSignal: 'FILTER THE SIGNAL',
    matchesInView_one: '{formattedCount} match in view',
    matchesInView_other: '{formattedCount} matches in view',
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
    minGamesAriaLabel_one: 'Show heroes with at least {formattedCount} game',
    minGamesAriaLabel_other: 'Show heroes with at least {formattedCount} games',
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
    allModes: 'All modes',
    gameModeAllPick: 'All Pick',
    gameModeRanked: 'Ranked',
    gameModeRankedAllPick: 'Ranked All Pick',
    gameModeTurbo: 'Turbo',
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
    minGamesSuffix: '{formattedCount}+',

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

    // Scoreboard metric tooltips
    scoreboardMetricHero: 'Hero',
    scoreboardMetricPlayer: 'Player',
    scoreboardMetricKda: 'Kills / Deaths / Assists',
    scoreboardMetricNetWorth: 'Net worth',
    scoreboardMetricImp: 'Individual match performance',
    scoreboardMetricLastHitsDenies: 'Last hits / Denies',
    scoreboardMetricLastHits: 'Last hits',
    scoreboardMetricDenies: 'Denies',
    scoreboardMetricGoldExperiencePerMinute: 'Gold per minute / Experience per minute',
    scoreboardMetricHeroDamage: 'Hero damage',
    scoreboardMetricTowerDamage: 'Tower damage',
    scoreboardMetricHeroHealing: 'Hero healing',
    scoreboardMetricInventory: 'Inventory',
    scoreboardMetricKills: 'Kills',
    scoreboardMetricDeaths: 'Deaths',
    scoreboardMetricAssists: 'Assists',
    scoreboardMetricGoldPerMinute: 'Gold per minute',
    scoreboardMetricExperiencePerMinute: 'Experience per minute',
    scoreboardMetricBestInMatch: '{metric} · Best in match',
    scoreboardTeamRadiant: 'Radiant',
    scoreboardTeamDire: 'Dire',
    scoreboardTeamTotals: 'Team totals',
    scoreboardTeamTotal: '{team} total',
    scoreboardPermanentUpgradesAriaLabel: 'Permanent upgrades',
    scoreboardAghanimScepterLabel: "Aghanim's Scepter",
    scoreboardAghanimShardLabel: "Aghanim's Shard",
    scoreboardMoonShardLabel: 'Moon Shard',
    scoreboardPermanentUpgradeAriaLabel: '{upgrade}: {item}',
    scoreboardPermanentUpgradeEmptyAriaLabel: '{upgrade} not acquired',
    scoreboardPermanentUpgradeTooltip: 'Permanent {upgrade} upgrade',
    scoreboardPermanentUpgradeEmptyTooltip: 'No permanent {upgrade} upgrade',

  }
} as const;

export type Locale = 'en';
type PluralBaseKeys<T> = T extends `${infer Base}_${'one' | 'other'}` ? Base : never;
export type TranslationKey = keyof typeof translations.en | PluralBaseKeys<keyof typeof translations.en>;
type TranslationReplacements = Record<string, string | number> & { count?: number };

export function getPluralSuffix(n: number): 'one' | 'other' {
  return n === 1 ? 'one' : 'other';
}

export function translate(
  locale: Locale,
  key: string,
  replacements?: TranslationReplacements,
): string {
  const dictionary: Record<string, string> = translations[locale];
  let resolvedKey = key;
  if (replacements && 'count' in replacements) {
    const suffix = getPluralSuffix(replacements.count ?? 0);
    const pluralKey = `${key}_${suffix}`;

    if (pluralKey in dictionary) {
      resolvedKey = pluralKey;
    } else if (suffix !== 'other') {
      const otherKey = `${key}_other`;
      if (otherKey in dictionary) {
        resolvedKey = otherKey;
      }
    }
  }

  let val = dictionary[resolvedKey];
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
  t: (key: TranslationKey, replacements?: TranslationReplacements) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  const t = (key: TranslationKey, replacements?: TranslationReplacements): string => {
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
    console.warn('useTranslation was called outside of an I18nProvider. Falling back to English.');
    const t = (key: TranslationKey, replacements?: TranslationReplacements): string => {
      return translate('en', key, replacements);
    };
    return { locale: 'en' as const, setLocale: () => {}, t };
  }
  return context;
}
