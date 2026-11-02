const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

export async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(enc.encode(text));
}

/** Canonical hash of a source row: all cells in header order, unit-separator joined. */
export async function canonicalRowHash(row: string[]): Promise<string> {
  return sha256Text(row.join('\u001f'));
}

export function newId(): string {
  return crypto.randomUUID();
}
