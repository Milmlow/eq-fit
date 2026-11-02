// Browser-only decryption for EQ Fit's encrypted Garmin GitHub Actions export.
// Passphrases remain in the page's memory; never send them to the website, server,
// analytics, logs or storage. Format matches scripts/export_garmin_encrypted.py.
const MAGIC = new TextEncoder().encode('EQFITG1!');
const SALT_LENGTH = 16;
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const ITERATIONS = 600_000;
export const MAX_GARMIN_ENCRYPTED_BYTES = 25 * 1024 * 1024 + 128;

export async function decryptGarminExport(bytes: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (bytes.length < MAGIC.length + SALT_LENGTH + NONCE_LENGTH + TAG_LENGTH ||
      bytes.length > MAX_GARMIN_ENCRYPTED_BYTES ||
      !MAGIC.every((b, i) => bytes[i] === b)) {
    throw new Error('Invalid encrypted EQ Fit export, or file too large.');
  }
  if (passphrase.length < 16) {
    throw new Error('Use the separate EQ Fit export passphrase (at least 16 characters), not the Garmin API key.');
  }
  const salt = new Uint8Array(bytes.subarray(8, 24));
  const nonce = new Uint8Array(bytes.subarray(24, 36));
  const ciphertext = new Uint8Array(bytes.subarray(36));
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: MAGIC, tagLength: 128 },
      key, ciphertext,
    );
    return new Uint8Array(plain);
  } catch {
    // Never reveal plaintext or sensitive WebCrypto error details.
    throw new Error('Unable to decrypt. Check the EQ Fit passphrase and selected file.');
  }
}
