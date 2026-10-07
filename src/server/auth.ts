import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cache } from "react";
import { cookies } from "next/headers";
import { execute, getDb, queryOne } from "./db";
import type { RowDataPacket } from "mysql2/promise";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keyLength: number
) => Promise<Buffer>;

const SESSION_COOKIE = "tc_session";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

export interface SessionUser {
  id: number;
  username: string;
}

export const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,20}$/;
export const EMAIL_MAX = 254;
// Deliberately loose: one "@", something on each side, a dot in the domain. Real
// validity is proven later by sending a verification email.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Lowercased and trimmed, or null if it does not look like an email address. */
export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= EMAIL_MAX && EMAIL_PATTERN.test(email) ? email : null;
}
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Checked against when a username does not exist, so a login attempt takes the
// same time whether or not the account is real.
let dummyHash: Promise<string> | undefined;
export function verifyAgainstDummy(password: string): Promise<boolean> {
  dummyHash ??= hashPassword(randomBytes(8).toString("hex"));
  return dummyHash.then((hash) => verifyPassword(password, hash));
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;

  await execute(db, "DELETE FROM sessions WHERE expires_at < ?", [Date.now()]);
  await execute(db, "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [
    hashToken(token),
    userId,
    expiresAt
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await execute(getDb(), "DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  cookieStore.delete(SESSION_COOKIE);
}

/** The signed-in user for this request, or null. Cached for the duration of a render. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<RowDataPacket & { id: number; username: string }>(
    getDb(),
      `SELECT u.id AS id, u.username AS username
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(token), Date.now()]
  );

  return row ? { id: row.id, username: row.username } : null;
});

export async function findUserByUsername(username: string): Promise<SessionUser | null> {
  const row = await queryOne<RowDataPacket & SessionUser>(
    getDb(),
    "SELECT id, username FROM users WHERE username = ?",
    [username]
  );
  return row ? { id: row.id, username: row.username } : null;
}

// Login throttling. In memory, so it resets on restart and is per server process.
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MS = 10 * 60 * 1000;
const failedLogins = new Map<string, { count: number; firstAt: number }>();

export function isLoginLocked(username: string): boolean {
  const key = username.toLowerCase();
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedLogins.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILED_LOGINS;
}

export function recordFailedLogin(username: string): void {
  const key = username.toLowerCase();
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedLogins.set(key, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearFailedLogins(username: string): void {
  failedLogins.delete(username.toLowerCase());
}

/** Only allow redirecting back to a path on this site. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}
