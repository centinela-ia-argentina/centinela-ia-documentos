import { createClient } from '@supabase/supabase-js';

export type ActorType = 'human' | 'agent' | 'system';

export interface LedgerEntryPayload {
  [key: string]: any;
}

export interface AppendLedgerEntryParams {
  org_id: string;
  actor_type: ActorType;
  actor_id: string;
  action: string;
  object_type?: string | null;
  object_id?: string | null;
  payload?: LedgerEntryPayload;
}

export interface AppendLedgerEntryResult {
  seq: number;
  entry_hash: string;
}

/**
 * Appends a new event to the security ledger.
 * This operation is serialized per organization and immutable.
 */
export async function appendLedgerEntry(
  supabase: ReturnType<typeof createClient>,
  params: AppendLedgerEntryParams
): Promise<AppendLedgerEntryResult> {
  // Validate that payload does not contain floats at the application level
  if (params.payload && hasFloat(params.payload)) {
    throw new Error('Payload cannot contain floating point numbers');
  }

  const { data, error } = await supabase.rpc('ledger_append', {
    p_org_id: params.org_id,
    p_actor_type: params.actor_type,
    p_actor_id: params.actor_id,
    p_action: params.action,
    p_object_type: params.object_type || null,
    p_object_id: params.object_id || null,
    p_payload: params.payload || {}
  });

  if (error) {
    throw new Error(`Failed to append ledger entry: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No data returned from ledger_append');
  }

  return {
    seq: data[0].seq,
    entry_hash: data[0].entry_hash
  };
}

function hasFloat(val: any): boolean {
  if (typeof val === 'number') {
    return !Number.isInteger(val);
  }
  if (Array.isArray(val)) {
    return val.some(hasFloat);
  }
  if (val !== null && typeof val === 'object') {
    return Object.values(val).some(hasFloat);
  }
  return false;
}
