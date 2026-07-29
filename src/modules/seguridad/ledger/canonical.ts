import crypto from 'crypto';

export function hasLoneSurrogate(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 === str.length || str.charCodeAt(i + 1) < 0xdc00 || str.charCodeAt(i + 1) > 0xdfff) {
        return true;
      }
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function canonicalString(str: string): string {
  if (hasLoneSurrogate(str)) {
    throw new Error('String contains lone surrogate');
  }
  let res = '"';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 0x22) { res += '\\"'; }
    else if (code === 0x5c) { res += '\\\\'; }
    else if (code === 0x08) { res += '\\b'; }
    else if (code === 0x0c) { res += '\\f'; }
    else if (code === 0x0a) { res += '\\n'; }
    else if (code === 0x0d) { res += '\\r'; }
    else if (code === 0x09) { res += '\\t'; }
    else if (code < 0x20) {
      res += '\\u00' + code.toString(16).padStart(2, '0').toLowerCase();
    } else {
      res += str[i];
    }
  }
  return res + '"';
}

export function canonicalJson(val: any): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  
  if (typeof val === 'string') {
    return canonicalString(val);
  }
  
  if (typeof val === 'number') {
    const str = val.toString();
    if (!/^-?(0|[1-9][0-9]*)$/.test(str)) {
      throw new Error(`Invalid number format in canonical JSON: ${str}`);
    }
    if (val < -9007199254740991 || val > 9007199254740991) {
      throw new Error(`Number out of safe integer range in canonical JSON: ${str}`);
    }
    return str;
  }
  
  if (Array.isArray(val)) {
    return '[' + val.map(item => canonicalJson(item)).join(',') + ']';
  }
  
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    for (const key of keys) {
      for (const char of key) {
        if (char.codePointAt(0)! >= 0x10000) {
          throw new Error(`Object key "${key}" contains characters outside BMP (>= U+10000)`);
        }
      }
    }
    keys.sort((a, b) => {
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(b, 'utf8');
      return bufA.compare(bufB);
    });
    
    const pairs = keys.map(k => `${canonicalString(k)}:${canonicalJson(val[k])}`);
    return '{' + pairs.join(',') + '}';
  }
  
  throw new Error('Unknown type');
}

export function formatOccurredAt(val: string | Date): string {
  let str = typeof val === 'string' ? val : val.toISOString();
  str = str.replace(' ', 'T');
  const match = str.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/);
  if (match) {
    const [, datePart, timePart, fracPart = '000000', tz = 'Z'] = match;
    let fract6 = (fracPart + '000000').slice(0, 6);
    if (tz === 'Z' || tz === '+00' || tz === '+00:00' || tz === '-00' || tz === '-00:00' || tz === '') {
      return `${datePart}T${timePart}.${fract6}Z`;
    } else {
      const d = new Date(str);
      const iso = d.toISOString();
      const isoMatch = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d+)Z$/);
      if (isoMatch) {
        return `${isoMatch[1]}.${fract6}Z`;
      }
    }
  }
  const d = new Date(val);
  const iso = d.toISOString();
  return iso.replace(/\.(\d{3})Z$/, (m, p1) => `.${p1}000Z`);
}

export function createEnvelope(row: Record<string, any>): Record<string, any> {
  return {
    action: row.action ?? null,
    actor_id: row.actor_id ?? null,
    actor_type: row.actor_type ?? null,
    object_id: row.object_id ?? null,
    object_type: row.object_type ?? null,
    occurred_at: row.occurred_at ? formatOccurredAt(row.occurred_at) : null,
    org_id: row.org_id ? String(row.org_id).toLowerCase() : null,
    payload: row.payload ?? null,
    seq: typeof row.seq === 'string' ? parseInt(row.seq, 10) : (row.seq ?? null)
  };
}

export function toBuffer(hash: string | Buffer): Buffer {
  if (Buffer.isBuffer(hash)) return hash;
  if (typeof hash === 'string') {
    const hex = hash.startsWith('\\x') ? hash.slice(2) : (hash.startsWith('0x') ? hash.slice(2) : hash);
    return Buffer.from(hex, 'hex');
  }
  throw new Error('Invalid hash format');
}

export function calculateEntryHash(row: Record<string, any>): Buffer {
  const envelope = createEnvelope(row);
  const canonicalStr = canonicalJson(envelope);
  const prevHashBuf = toBuffer(row.prev_hash);
  const canonBuf = Buffer.from(canonicalStr, 'utf8');
  const combined = Buffer.concat([prevHashBuf, canonBuf]);
  return crypto.createHash('sha256').update(combined).digest();
}
