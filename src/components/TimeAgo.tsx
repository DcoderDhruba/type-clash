"use client";

import { useEffect, useState } from "react";

function describe(then: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

/** "3 minutes ago". Worked out in the browser, so it cannot disagree with the server's clock. */
export function TimeAgo({ at }: { at: number }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const update = () => setText(describe(at));
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [at]);

  return <span suppressHydrationWarning>{text}</span>;
}
