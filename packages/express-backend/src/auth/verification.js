import { Buffer } from "node:buffer";
import crypto from "node:crypto";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// A new 6-digit code. Only its hash is stored, so reading
// users.json doesn't reveal anyone's code.
export function newVerification(now = Date.now()) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(
    6,
    "0"
  );
  return {
    code,
    record: {
      codeHash: hashCode(code),
      expiresAt: now + CODE_TTL_MS,
      sentAt: now,
      attempts: 0
    }
  };
}

// Returns "ok", "wrong", "expired" or "locked".
export function checkCode(record, code, now = Date.now()) {
  if (!record) return "expired";
  if (record.attempts >= MAX_ATTEMPTS) return "locked";
  if (now > record.expiresAt) return "expired";

  const given = Buffer.from(hashCode(String(code).trim()));
  const expected = Buffer.from(record.codeHash);
  return crypto.timingSafeEqual(given, expected)
    ? "ok"
    : "wrong";
}

export function canResend(record, now = Date.now()) {
  return !record || now - record.sentAt >= RESEND_COOLDOWN_MS;
}
