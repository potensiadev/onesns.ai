/**
 * AES-256-GCM encryption/decryption helper for sensitive tokens.
 * Requires ENCRYPTION_KEY environment variable (base64-encoded 32-byte key).
 * Generate with: openssl rand -base64 32
 */

const ENCRYPTION_KEY_ENV = "ENCRYPTION_KEY";

async function getEncryptionKey(): Promise<CryptoKey> {
  const base64Key = Deno.env.get(ENCRYPTION_KEY_ENV);
  if (!base64Key) {
    throw new Error(`${ENCRYPTION_KEY_ENV} environment variable is not set`);
  }

  // Decode base64 to raw bytes
  const keyData = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

  if (keyData.length !== 32) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be a 32-byte key (base64-encoded)`);
  }

  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext secret using AES-256-GCM.
 * Returns a base64-encoded string in the format: iv:ciphertext:authTag
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    data
  );

  // Combine IV + ciphertext (last 16 bytes are the auth tag)
  const encryptedArray = new Uint8Array(encrypted);

  // Convert to base64: iv:ciphertext
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));

  return `${ivBase64}:${encryptedBase64}`;
}

/**
 * Decrypts a secret encrypted with encryptSecret.
 * Expects format: iv:ciphertext (base64-encoded)
 */
export async function decryptSecret(encryptedValue: string): Promise<string> {
  const key = await getEncryptionKey();

  // Parse the format: iv:ciphertext
  const parts = encryptedValue.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivBase64, encryptedBase64] = parts;

  // Decode from base64
  const iv = Uint8Array.from(atob(ivBase64), (c) => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encrypted
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
