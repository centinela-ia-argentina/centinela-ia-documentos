import { canonicalJson } from './canonical';

export type CheckpointEnvelope = {
  algo: string;
  canon_version: number;
  head_hash: string;
  key_id: string;
  org_id: string;
  seq_from: number;
  seq_to: number;
  signed_at: string;
};

export function formatSignedAt(val: string | Date): string {
  let str = typeof val === 'string' ? val : val.toISOString();
  str = str.replace(' ', 'T');
  const match = str.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/);
  if (match) {
    const [, datePart, timePart, fracPart = '000000', tz = 'Z'] = match;
    const fract6 = (fracPart + '000000').slice(0, 6);
    if (tz === 'Z' || tz === '+00' || tz === '+00:00' || tz === '-00' || tz === '-00:00' || tz === '') {
      return `${datePart}T${timePart}.${fract6}Z`;
    }
  }
  const d = new Date(val);
  const iso = d.toISOString();
  const isoMatch = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d+)Z$/);
  if (isoMatch) {
    const fract6 = (isoMatch[2] + '000000').slice(0, 6);
    return `${isoMatch[1]}.${fract6}Z`;
  }
  throw new Error('Invalid date format');
}

export function buildCheckpointEnvelope(data: Record<string, any>): CheckpointEnvelope {
  // Validate no extra keys (criterio 7)
  const allowedKeys = new Set(['algo', 'canon_version', 'head_hash', 'key_id', 'org_id', 'seq_from', 'seq_to', 'signed_at']);
  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) {
      throw new Error(`Invalid key in envelope: ${k}`);
    }
  }
  // Check that all required keys are present
  for (const k of allowedKeys) {
    if (!(k in data) || data[k] === undefined) {
      throw new Error(`Missing required key in envelope: ${k}`);
    }
  }

  // org_id (criterio 6: Un org_id en mayusculas es normalizado a minusculas)
  let org_id = String(data.org_id);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(org_id)) {
    org_id = org_id.toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(org_id)) {
      throw new Error('org_id must be a valid UUID');
    }
  }

  // head_hash (criterios 4 y 5)
  let head_hash = '';
  if (Buffer.isBuffer(data.head_hash)) {
    head_hash = data.head_hash.toString('hex');
  } else if (typeof data.head_hash === 'string') {
    let hex = data.head_hash.toLowerCase();
    if (hex.startsWith('\\x')) hex = hex.slice(2);
    else if (hex.startsWith('0x')) hex = hex.slice(2);
    head_hash = hex;
  } else {
    throw new Error('head_hash must be a Buffer or string');
  }
  if (head_hash.length !== 64 || !/^[0-9a-f]{64}$/.test(head_hash)) {
    throw new Error('head_hash must be exactly 64 hex characters');
  }

  // sequences
  const seq_from = Number(data.seq_from);
  const seq_to = Number(data.seq_to);
  const canon_version = Number(data.canon_version);
  if (!Number.isInteger(seq_from) || !Number.isInteger(seq_to) || !Number.isInteger(canon_version)) {
    throw new Error('seq_from, seq_to, and canon_version must be integers');
  }

  return {
    algo: String(data.algo),
    canon_version,
    head_hash,
    key_id: String(data.key_id),
    org_id,
    seq_from,
    seq_to,
    signed_at: formatSignedAt(data.signed_at)
  };
}

export function serializeCheckpointEnvelope(envelope: CheckpointEnvelope): Buffer {
  const canonStr = canonicalJson(envelope);
  return Buffer.from(canonStr, 'utf8');
}
