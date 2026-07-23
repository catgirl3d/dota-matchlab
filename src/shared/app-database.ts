import type { Database } from './database.types';
import type {
  ArchiveOverviewProjection,
  ArchivePageProjection,
  ArchiveShowcaseOverviewProjection,
} from './contracts/archive-rpc';
import type {
  DetailApplyResponse,
  PublicDetailApplyResponse,
  TrackedDetailClaim,
} from './contracts/detail-rpc';
import type {
  HistorySyncApplyResponse,
  HistorySyncClaim,
  RecordMatchSyncFailureResponse,
} from './contracts/history-rpc';

type GeneratedFunctions = Database['public']['Functions'];

type NullableOptionalArgs<Args, Name extends keyof Args> = Omit<Args, Name> & {
  [Key in Name]?: Exclude<Args[Key], undefined> | null;
};

type RpcArgsOverrides = {
  get_match_archive_overview: NullableOptionalArgs<
    GeneratedFunctions['get_match_archive_overview']['Args'],
    'p_hero_id' | 'p_start_date' | 'p_end_date'
  >;
  get_match_archive_page: NullableOptionalArgs<
    GeneratedFunctions['get_match_archive_page']['Args'],
    'p_hero_id' | 'p_start_date' | 'p_end_date' | 'p_cursor_start_time' | 'p_cursor_match_id'
  >;
  get_archive_showcase_overview: NullableOptionalArgs<
    GeneratedFunctions['get_archive_showcase_overview']['Args'],
    'p_hero_id' | 'p_start_date' | 'p_end_date'
  >;
  get_archive_showcase_page: NullableOptionalArgs<
    GeneratedFunctions['get_archive_showcase_page']['Args'],
    'p_hero_id' | 'p_start_date' | 'p_end_date' | 'p_cursor_start_time' | 'p_cursor_match_id'
  >;
};

type RpcReturnOverrides = {
  claim_match_sync_for_provider: HistorySyncClaim;
  apply_match_sync_page_with_boundary_source_and_payloads: HistorySyncApplyResponse;
  record_match_sync_failure: RecordMatchSyncFailureResponse;
  claim_specific_match_detail: TrackedDetailClaim;
  apply_match_detail_batch: DetailApplyResponse;
  apply_public_match_import: PublicDetailApplyResponse;
  get_match_archive_overview: ArchiveOverviewProjection;
  get_match_archive_page: ArchivePageProjection;
  get_archive_showcase_overview: ArchiveShowcaseOverviewProjection | null;
  get_archive_showcase_page: ArchivePageProjection | null;
  resolve_archive_showcase: number | null;
};

type Assert<T extends true> = T;
export type OverridesNameExistingFunctions = Assert<
  Exclude<keyof RpcArgsOverrides | keyof RpcReturnOverrides, keyof GeneratedFunctions> extends never ? true : false
>;

type WithContractArgs<TFunctions> = {
  [Name in keyof TFunctions]: Name extends keyof RpcArgsOverrides
    ? TFunctions[Name] extends { Args: unknown }
      ? Omit<TFunctions[Name], 'Args'> & { Args: RpcArgsOverrides[Name] }
      : TFunctions[Name]
    : TFunctions[Name];
};

type WithContractReturns<TFunctions> = {
  [Name in keyof TFunctions]: Name extends keyof RpcReturnOverrides
    ? TFunctions[Name] extends { Returns: unknown }
      ? Omit<TFunctions[Name], 'Returns'> & { Returns: RpcReturnOverrides[Name] }
      : TFunctions[Name]
    : TFunctions[Name];
};

type AppPublicSchema = Omit<Database['public'], 'Functions'> & {
  Functions: WithContractReturns<WithContractArgs<GeneratedFunctions>>;
};

export type AppDatabase = Omit<Database, 'public'> & { public: AppPublicSchema };

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;

export type ClaimArgsRemainGenerated = Assert<Equal<
  AppDatabase['public']['Functions']['claim_match_sync_for_provider']['Args'],
  Database['public']['Functions']['claim_match_sync_for_provider']['Args']
>>;
export type RpcOverlayArgsRemainGenerated = ClaimArgsRemainGenerated;
