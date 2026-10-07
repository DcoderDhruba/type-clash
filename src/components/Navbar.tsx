"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { InviteBell } from "@/components/InviteBell";
import { RESET_TEST_EVENT } from "@/lib/events";
import type { ClientUser } from "@/components/UserProvider";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard", icon: "bi-trophy" },
  { href: "/challenge", label: "Challenge", icon: "bi-lightning-charge" },
] as const;

export function Navbar({ user }: { user: ClientUser | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-full items-center justify-between gap-4 px-6 py-4">
      <Link
        href="/"
        aria-label="TypeChaze home"
        onClick={() => window.dispatchEvent(new Event(RESET_TEST_EVENT))}
      >
        <Image
          src="/typechaze.png"
          alt="TypeChaze"
          width={2064}
          height={762}
          priority
          className="h-10 w-auto"
        />
      </Link>

      <div className="flex items-center gap-1 sm:gap-2">
        {LINKS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:text-accent ${
                active ? "text-accent" : "text-sub"
              }`}
            >
              <i className={`bi ${icon} text-xl`} aria-hidden="true" />
              <span className="hidden text-sm font-medium md:inline">{label}</span>
            </Link>
          );
        })}

        {user && <InviteBell />}

        {user ? (
          <div className="ml-1 flex items-center gap-1 sm:ml-3">
            <Link
              href={`/profile/${encodeURIComponent(user.username)}`}
              title="Your profile"
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text transition-colors hover:text-accent"
            >
              <i className="bi bi-person-fill text-xl text-accent" aria-hidden="true" />
              <span className="hidden max-w-32 truncate sm:inline">{user.username}</span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Log out"
                title="Log out"
                className="flex size-10 items-center justify-center rounded-lg text-xl text-sub transition-colors hover:text-accent"
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" />
              </button>
            </form>
          </div>
        ) : (
          <div className="ml-1 flex items-center gap-2 sm:ml-3">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-sub transition-colors hover:text-accent"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
