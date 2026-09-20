"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signup } from "@/app/actions/auth";

interface AuthFormProps {
  mode: "login" | "signup";
  next: string;
}

const COPY = {
  login: {
    title: "Log in",
    submit: "Log in",
    switchText: "New here?",
    switchLink: "Create an account",
    switchHref: "/signup",
    passwordAutocomplete: "current-password",
  },
  signup: {
    title: "Create account",
    submit: "Sign up",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
    passwordAutocomplete: "new-password",
  },
} as const;

const INPUT_CLASS =
  "w-full rounded-lg border bg-bg px-4 py-3 text-base text-text outline-none transition-colors focus:border-accent";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

/** A labelled input with a note underneath that turns into the error message when there is one. */
function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-sub">
        {label}
      </label>
      {children}
      <p
        id={`${id}-note`}
        role={error ? "alert" : undefined}
        className={`min-h-4 text-xs ${error ? "text-error" : "text-sub"}`}
      >
        {error ?? hint}
      </p>
    </div>
  );
}

export function AuthForm({ mode, next }: AuthFormProps) {
  const copy = COPY[mode];
  const [state, action, pending] = useActionState(mode === "login" ? login : signup, undefined);
  // Kept in state so a failed attempt does not wipe what was typed.
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const switchHref = next === "/" ? copy.switchHref : `${copy.switchHref}?next=${encodeURIComponent(next)}`;
  const errorFor = (field: "email" | "username" | "password") => (state?.field === field ? state.error : undefined);
  const generalError = state?.field ? undefined : state?.error;
  const borderFor = (error?: string) => (error ? "border-error" : "border-text/10");

  return (
    <form action={action} noValidate className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-panel p-8">
      <h1 className="mb-2 text-3xl font-bold text-accent">{copy.title}</h1>
      <input type="hidden" name="next" value={next} />

      {mode === "signup" ? (
        <>
          <Field id="email" label="Email" error={errorFor("email")} hint="We'll use this to verify your account.">
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={errorFor("email") ? true : undefined}
              aria-describedby="email-note"
              className={`${INPUT_CLASS} ${borderFor(errorFor("email"))}`}
            />
          </Field>

          <Field
            id="username"
            label="Username"
            error={errorFor("username")}
            hint="Shown on the leaderboard. 3-20 letters, numbers, _ . or -"
          >
            <input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="nickname"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={20}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={errorFor("username") ? true : undefined}
              aria-describedby="username-note"
              className={`${INPUT_CLASS} ${borderFor(errorFor("username"))}`}
            />
          </Field>
        </>
      ) : (
        <Field id="identifier" label="Email or username">
          <input
            id="identifier"
            name="identifier"
            type="text"
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={254}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className={`${INPUT_CLASS} border-text/10`}
          />
        </Field>
      )}

      <Field
        id="password"
        label="Password"
        error={errorFor("password")}
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      >
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete={copy.passwordAutocomplete}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errorFor("password") ? true : undefined}
            aria-describedby="password-note"
            className={`${INPUT_CLASS} pr-12 ${borderFor(errorFor("password"))}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-xl text-sub transition-colors hover:text-accent"
          >
            <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
          </button>
        </div>
      </Field>

      {generalError && (
        <p role="alert" className="text-sm text-error">
          {generalError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-accent px-4 py-3 font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Please wait..." : copy.submit}
      </button>

      <p className="mt-1 text-center text-sm text-sub">
        {copy.switchText}{" "}
        <Link href={switchHref} className="text-accent hover:underline">
          {copy.switchLink}
        </Link>
      </p>
    </form>
  );
}
