import * as crypto from 'node:crypto';


export function computeHmac(secret: string | Buffer, payload: string | Buffer): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));     // Lengths differ – still run a dummy comparison to avoid timing leaks

    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

interface VerifySignatureOptions {
  secret: string | Buffer;
  payload: string | Buffer;
  signature: string | undefined | null;
}

export function verifySignature({ secret, payload, signature }: VerifySignatureOptions): boolean {
  if (!signature) {
    return false;
  }
  const prefix = 'sha256=';
  const normalised = signature.startsWith(prefix) ? signature.slice(prefix.length) : signature;

  const expected = computeHmac(secret, payload);

  return safeCompare(normalised, expected);
}