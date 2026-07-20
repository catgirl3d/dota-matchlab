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

type RpcReturnOverrides = {
  claim_match_sync_for_provider: HistorySyncClaim;
  apply_match_sync_page_with_boundary_source_and_payloads: HistorySyncApplyResponse;
  record_match_sync_failure: RecordMatchSyncFailureResponse;
  claim_specific_match_detail: TrackedDetailClaim;
  apply_match_detail_batch: DetailApplyResponse;
  apply_public_match_import: PublicDetailApplyResponse;
  get_match_archive_overview: ArchiveOverviewProjection;
  get_match_archive_page: ArchivePageProjection;
  get_archive_showcase_overview: ArchiveShowcaseOverviewProjection;
  get_archive_showcase_page: ArchivePageProjection;
};

type Assert<T extends true> = T;
export type OverridesNameExistingFunctions = Assert<
  Exclude<keyof RpcReturnOverrides, keyof GeneratedFunctions> extends never ? true : false
>;

type WithContractReturns<TFunctions> = {
  [Name in keyof TFunctions]: Name extends keyof RpcReturnOverrides
    ? TFunctions[Name] extends { Returns: unknown }
      ? Omit<TFunctions[Name], 'Returns'> & { Returns: RpcReturnOverrides[Name] }
      : TFunctions[Name]
    : TFunctions[Name];
};

type AppPublicSchema = Omit<Database['public'], 'Functions'> & {
  Functions: WithContractReturns<GeneratedFunctions>;
};

export type AppDatabase = Omit<Database, 'public'> & { public: AppPublicSchema };

type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;

export type ClaimArgsRemainGenerated = Assert<Equal<
  AppDatabase['public']['Functions']['claim_match_sync_for_provider']['Args'],
  Database['public']['Functions']['claim_match_sync_for_provider']['Args']
>>;
export type ArchiveArgsRemainGenerated = Assert<Equal<
  AppDatabase['public']['Functions']['get_match_archive_overview']['Args'],
  Database['public']['Functions']['get_match_archive_overview']['Args']
>>;
export type RpcOverlayArgsRemainGenerated = ClaimArgsRemainGenerated | ArchiveArgsRemainGenerated;
