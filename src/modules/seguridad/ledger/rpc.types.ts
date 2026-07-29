export interface LedgerAppendArgs {
  p_org_id: string;
  p_actor_type: string;
  p_actor_id: string;
  p_action: string;
  p_object_type: string | null;
  p_object_id: string | null;
  p_payload: Record<string, unknown>;
}

export interface LedgerAppendResult {
  seq: number;
  entry_hash: string;
}

export type LedgerAppendRpc = (
  fn: 'ledger_append',
  args: LedgerAppendArgs
) => Promise<{ data: LedgerAppendResult[] | null; error: Error | null }>;
