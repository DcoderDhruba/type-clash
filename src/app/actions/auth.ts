"use server";

import { redirect } from "next/navigation";
import { execute, getDb, queryOne } from "@/server/db";
import type { QueryResultRow } from "pg";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_PATTERN,
  clearFailedLogins,
  createSession,
  destroySession,
  hashPassword,
  isLoginLocked,
  normalizeEmail,
  recordFailedLogin,
  safeNextPath,
  verifyAgainstDummy,
  verifyPassword,
} from "@/server/auth";

export interface AuthFormState {
  error?: string;
  /** Which input the error is about, so the form can show it next to that input. */
  field?: "email" | "username" | "password";
}

export async function signup(_prev: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const email = normalizeEmail(rawEmail);
  if (!email) return { field: "email", error: "Enter a valid email address, like name@example.com." };
  if (!USERNAME_PATTERN.test(username)) {
    return {
      field: "username",
      error: "Username must be 3-20 characters: letters, numbers, underscore, dot or hyphen.",
    };
  }
  if (password.length < PASSWORD_MIN) {
    return { field: "password", error: `Password must be at least ${PASSWORD_MIN} characters.` };
  }
  if (password.length > PASSWORD_MAX) {
    return { field: "password", error: `Password must be at most ${PASSWORD_MAX} characters.` };
  }

  const db = getDb();
  const taken = async (): Promise<AuthFormState | null> => {
    if (await queryOne<QueryResultRow>(db, "SELECT 1 FROM users WHERE email = ?", [email])) {
      return { field: "email", error: "An account with this email already exists. Try logging in." };
    }
    if (await queryOne<QueryResultRow>(db, "SELECT 1 FROM users WHERE LOWER(username) = LOWER(?)", [username])) {
      return { field: "username", error: "That username is already taken." };
    }
    return null;
  };

  const conflict = await taken();
  if (conflict) return conflict;

  let userId: number;
  try {
    // email_verified stays 0 until a verification email is sent and confirmed.
    const result = await execute(
      db,
      "INSERT INTO users (username, password_hash, created_at, email, email_verified) VALUES (?, ?, ?, ?, 0) RETURNING id",
      [username, await hashPassword(password), Date.now(), email]
    );
    userId = result.insertId;
  } catch (error) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "23505") {
      throw error;
    }
    // Lost a race with another signup for the same email or username.
    return (await taken()) ?? { error: "Could not create the account. Try again." };
  }

  await createSession(userId);
  redirect(next);
}

export async function login(_prev: AuthFormState | undefined, formData: FormData): Promise<AuthFormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!identifier || !password) return { error: "Enter your email or username, and your password." };
  if (isLoginLocked(identifier)) {
    return { error: "Too many failed attempts. Try again in a few minutes." };
  }

  // Usernames cannot contain "@", so an "@" means the person typed an email address.
  const db = getDb();
  const email = identifier.includes("@") ? normalizeEmail(identifier) : null;
  const user = email || !identifier.includes("@")
    ? await queryOne<QueryResultRow & { id: number; password_hash: string }>(
        db,
        identifier.includes("@")
          ? "SELECT id, password_hash FROM users WHERE email = ?"
          : "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER(?)",
        [identifier.includes("@") ? email : identifier]
      )
    : undefined;

  const valid = user ? await verifyPassword(password, user.password_hash) : await verifyAgainstDummy(password);
  if (!user || !valid) {
    recordFailedLogin(identifier);
    return { error: "Wrong email, username or password." };
  }

  clearFailedLogins(identifier);
  await createSession(user.id);
  redirect(next);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
