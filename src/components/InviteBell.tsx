"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@/components/UserProvider";

const CHECK_EVERY_MS = 10_000;

/** A bell with the number of challenges waiting for the logged-in player. */
export function InviteBell() {
  const user = useUser();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let stopped = false;

    async function check() {
      try {
        const response = await fetch("/api/invites", { cache: "no-store" });
        if (response.ok && !stopped) setCount(((await response.json()) as { invites: unknown[] }).invites.length);
      } catch {
        // Try again next time.
      }
    }

    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [user, pathname]);

  if (!user) return null;

  const label = count > 0 ? `${count} challenge${count === 1 ? "" : "s"} waiting for you` : "Challenges for you";
  return (
    <Link
      href="/invites"
      aria-label={label}
      title={label}
      className={`relative flex items-center rounded-lg px-3 py-2 transition-colors hover:text-accent ${
        count > 0 || pathname === "/invites" ? "text-accent" : "text-sub"
      }`}
    >
      <i className={`bi ${count > 0 ? "bi-bell-fill" : "bi-bell"} text-xl`} aria-hidden="true" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold leading-4 text-bg">
          {count}
        </span>
      )}
    </Link>
  );
}
