import * as crypto from 'crypto';
import { buildCheckpointEnvelope, serializeCheckpointEnvelope, CheckpointEnvelope } from './checkpoint_envelope';

export function signCheckpoint(
  org_id: string,
  seq_from: number,
  seq_to: number,
  canon_version: number,
  head_hash: string | Buffer,
  key_id: string,
  signed_at: string | Date,
  privateKeyPemRaw: string
): { envelope: CheckpointEnvelope, signature: Buffer } {
  const envelope = buildCheckpointEnvelope({
    org_id, seq_from, seq_to, canon_version, head_hash, key_id, signed_at, algo: 'ed25519'
  });
  
  const serialized = serializeCheckpointEnvelope(envelope);

  const privateKeyPem = privateKeyPemRaw.replace(/\\n/g, '\n');
  const privateKey = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8'
  });

  const signature = crypto.sign(null, serialized, privateKey);
  
  if (signature.length !== 64) {
    throw new Error('Firma generada no mide exactamente 64 bytes');
  }

  // head_hash must be exactly 64 hex characters (32 bytes) - buildCheckpointEnvelope checks this

  return { envelope, signature };
}

export function verifyCheckpoint(
  envelopeData: Record<string, any>,
  signature: Buffer,
  publicKeyPemRaw: string
): boolean {
  const envelope = buildCheckpointEnvelope(envelopeData);
  const serialized = serializeCheckpointEnvelope(envelope);

  const publicKeyPem = publicKeyPemRaw.replace(/\\n/g, '\n');
  const publicKey = crypto.createPublicKey({
    key: publicKeyPem,
    format: 'pem',
    type: 'spki'
  });

  return crypto.verify(null, serialized, publicKey, signature);
}
