/**
 * Ruliu Crypto Utilities.
 *
 * Implements AES-256-CBC encryption/decryption for Ruliu (百度如流) messages.
 * Based on Ruliu API documentation: https://qy.baidu.com/doc/index.html#/inner_serverapi/robot
 *
 * Ruliu uses AES-256-CBC with PKCS7 padding for message encryption.
 * The encodingAESKey is base64-encoded and needs to be decoded to get the actual AES key.
 */

import crypto from 'crypto';

/**
 * Ruliu Crypto Configuration.
 */
export interface RuliuCryptoConfig {
  /** Base64-encoded AES key (43 characters, provided by Ruliu) */
  encodingAESKey: string;
  /** Token for signature verification */
  token?: string;
}

/**
 * Ruliu encrypted message structure.
 */
export interface RuliuEncryptedMessage {
  /** Encrypted content (base64) */
  Encrypt: string;
  /** Message signature */
  MsgSignature: string;
  /** Timestamp */
  TimeStamp: string;
  /** Nonce */
  Nonce: string;
}

/**
 * Ruliu decrypted message structure.
 */
export interface RuliuDecryptedMessage {
  /** Random bytes (16 bytes) */
  random: Buffer;
  /** Message length (4 bytes, big-endian) */
  msgLen: number;
  /** Message content */
  msg: string;
  /** App ID */
  appId: string;
}

/**
 * AES Key info extracted from encodingAESKey.
 */
interface AESKeyInfo {
  /** AES key (32 bytes) */
  key: Buffer;
  /** IV (16 bytes, from first 16 bytes of key) */
  iv: Buffer;
}

/**
 * Get AES key and IV from encodingAESKey.
 *
 * The encodingAESKey is a 43-character base64 string.
 * After base64 decode, we get 32 bytes AES key + 16 bytes IV (total 48 bytes).
 * Actually, Ruliu uses the first 32 bytes as key and derives IV from it.
 */
function getAESKey(encodingAESKey: string): AESKeyInfo {
  // Add padding if needed (base64 requires length % 4 === 0)
  const paddedKey = encodingAESKey + '='.repeat((4 - (encodingAESKey.length % 4)) % 4);
  const keyBuffer = Buffer.from(paddedKey, 'base64');

  // Ruliu uses first 32 bytes as AES key, and the key itself (first 16 bytes) as IV
  return {
    key: keyBuffer.subarray(0, 32),
    iv: keyBuffer.subarray(0, 16),
  };
}

/**
 * PKCS7 padding.
 */
function pkcs7Pad(data: Buffer, blockSize: number): Buffer {
  const padLen = blockSize - (data.length % blockSize);
  const pad = Buffer.alloc(padLen, padLen);
  return Buffer.concat([data, pad]);
}

/**
 * PKCS7 unpadding.
 */
function pkcs7Unpad(data: Buffer): Buffer {
  const padLen = data[data.length - 1];
  return data.subarray(0, data.length - padLen);
}

/**
 * Ruliu Crypto class for message encryption/decryption.
 */
export class RuliuCrypto {
  private key: Buffer;
  private iv: Buffer;
  private token?: string;

  constructor(config: RuliuCryptoConfig) {
    const keyInfo = getAESKey(config.encodingAESKey);
    this.key = keyInfo.key;
    this.iv = keyInfo.iv;
    this.token = config.token;
  }

  /**
   * Decrypt an encrypted message from Ruliu.
   *
   * @param encryptedMsg - The encrypted message (base64 string)
   * @returns Decrypted message content
   */
  decrypt(encryptedMsg: string): string {
    // Decode base64
    const encrypted = Buffer.from(encryptedMsg, 'base64');

    // Decrypt using AES-256-CBC
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, this.iv);
    decipher.setAutoPadding(false); // We handle padding ourselves

    let decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    // Remove PKCS7 padding
    decrypted = pkcs7Unpad(decrypted);

    // Parse the decrypted message structure:
    // [random(16 bytes)][msgLen(4 bytes)][msg][appId]
    const random = decrypted.subarray(0, 16);
    const msgLen = decrypted.readUInt32BE(16);
    const msg = decrypted.subarray(20, 20 + msgLen).toString('utf8');
    const appId = decrypted.subarray(20 + msgLen).toString('utf8');

    return msg;
  }

  /**
   * Encrypt a message for Ruliu.
   *
   * @param msg - Message content to encrypt
   * @param appId - App ID
   * @returns Encrypted message (base64 string)
   */
  encrypt(msg: string, appId: string): string {
    // Build the message structure:
    // [random(16 bytes)][msgLen(4 bytes)][msg][appId]
    const random = crypto.randomBytes(16);
    const msgBuffer = Buffer.from(msg, 'utf8');
    const appIdBuffer = Buffer.from(appId, 'utf8');
    const msgLenBuffer = Buffer.alloc(4);
    msgLenBuffer.writeUInt32BE(msgBuffer.length, 0);

    const data = Buffer.concat([random, msgLenBuffer, msgBuffer, appIdBuffer]);

    // PKCS7 padding
    const padded = pkcs7Pad(data, 16);

    // Encrypt using AES-256-CBC
    const cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);
    cipher.setAutoPadding(false);

    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

    return encrypted.toString('base64');
  }

  /**
   * Generate signature for message verification.
   *
   * Signature = sha1(sort(token, timestamp, nonce, encrypt))
   *
   * @param timestamp - Timestamp string
   * @param nonce - Nonce string
   * @param encrypt - Encrypted message
   * @returns Signature string
   */
  generateSignature(timestamp: string, nonce: string, encrypt: string): string {
    if (!this.token) {
      throw new Error('Token is required for signature generation');
    }

    const arr = [this.token, timestamp, nonce, encrypt].sort();
    const str = arr.join('');
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  /**
   * Verify message signature.
   *
   * @param signature - Signature to verify
   * @param timestamp - Timestamp string
   * @param nonce - Nonce string
   * @param encrypt - Encrypted message
   * @returns Whether signature is valid
   */
  verifySignature(signature: string, timestamp: string, nonce: string, encrypt: string): boolean {
    const expected = this.generateSignature(timestamp, nonce, encrypt);
    return signature === expected;
  }
}