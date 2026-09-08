// Mirrors `rat.sync_status`, written by filemaker_sync's run_incremental_sync.py on every run
// (real load, "nothing to do" check, or --dry-run scan). See filemaker_sync/CLAUDE.md and its
// devlog/worksheet.md Session 18 for the write side — this app only ever reads it.
export interface SyncStatusRow {
  id: number
  run_at: string
  run_type: string
  dry_run: boolean
  new_count: number | null
  changed_count: number | null
  delta_count: number | null
  verified_count: number | null
  rejected_count: number | null
  real_changes: number | null
  manifest_advanced: number | null
  ok: boolean
  detail: unknown
}
