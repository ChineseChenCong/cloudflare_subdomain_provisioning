/**
 * 加密工具模块
 * 用于加密存储敏感数据（如 Cloudflare API Token）
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

/**
 * 从环境变量获取加密密钥
 */
export function getEncryptionKey(env: { ENCRYPTION_KEY?: string }): CryptoKey | null {
  if (!env.ENCRYPTION_KEY) {
    return null;
  }

  try {
    const encoder = new TextEncoder();
    const keyMaterial = encoder.encode(env.ENCRYPTION_KEY);

    // 使用 SHA-256 派生固定长度密钥
    return crypto.subtle.importKey(
      'raw',
      keyMaterial,
      'AES-GCM',
      false,
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    console.error('Failed to create encryption key:', err);
    return null;
  }
}

/**
 * 加密文本
 */
export async function encryptText(
  env: { ENCRYPTION_KEY?: string },
  plaintext: string
): Promise<string | null> {
  const key = getEncryptionKey(env);
  if (!key) {
    console.warn('ENCRYPTION_KEY not configured, data will not be encrypted');
    return plaintext; // 降级处理：返回明文
  }

  try {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      encoded
    );

    // 组合 IV + 密文，并进行 Base64 编码
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error('Encryption failed:', err);
    return null;
  }
}

/**
 * 解密文本
 */
export async function decryptText(
  env: { ENCRYPTION_KEY?: string },
  encrypted: string
): Promise<string | null> {
  const key = getEncryptionKey(env);
  if (!key) {
    console.warn('ENCRYPTION_KEY not configured, returning data as-is');
    return encrypted; // 降级处理
  }

  try {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

/**
 * 生成随机令牌
 */
export function generateToken(length: number = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 哈希敏感数据（用于比较，不可逆）
 */
export async function hashSensitive(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
