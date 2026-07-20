import type { Json } from './database.types';
import type { AppDatabase } from './app-database';
import type { ArchiveOverviewProjection } from './contracts/archive-rpc';
import type { TrackedDetailClaim } from './contracts/detail-rpc';
import type { HistorySyncClaim } from './contracts/history-rpc';

type Assert<T extends true> = T;
type Equal<Left, Right> = (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2) ? true : false;

type _HistoryClaimReturnIsSchemaDto = Assert<Equal<
  AppDatabase['public']['Functions']['claim_match_sync_for_provider']['Returns'],
  HistorySyncClaim
>>;
type _DetailClaimReturnIsSchemaDto = Assert<Equal<
  AppDatabase['public']['Functions']['claim_specific_match_detail']['Returns'],
  TrackedDetailClaim
>>;
type _ArchiveReturnIsSchemaDto = Assert<Equal<
  AppDatabase['public']['Functions']['get_match_archive_overview']['Returns'],
  ArchiveOverviewProjection
>>;
type _HistoryClaimReturnIsNotGenericJson = Assert<Equal<
  Equal<AppDatabase['public']['Functions']['claim_match_sync_for_provider']['Returns'], Json>,
  false
>>;
type _PreserveGeneratedArgs = Assert<Equal<
  AppDatabase['public']['Functions']['apply_match_detail_batch']['Args']['p_results'],
  Json
>>;

export type RpcDatabaseContractTypecheck =
  | _HistoryClaimReturnIsSchemaDto
  | _DetailClaimReturnIsSchemaDto
  | _ArchiveReturnIsSchemaDto
  | _HistoryClaimReturnIsNotGenericJson
  | _PreserveGeneratedArgs;
