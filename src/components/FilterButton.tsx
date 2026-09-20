import Link from "next/link";

/** A filter, styled like the option buttons on the Start a match page: lime when selected. */
export function FilterButton({
  href,
  active,
  compact = false,
  children,
}: {
  href: string;
  active: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center justify-center rounded-lg py-2 text-sm font-medium transition-colors ${
        compact ? "px-2" : "px-4"
      } ${active ? "bg-accent text-bg" : "bg-bg text-sub hover:text-text"}`}
    >
      {children}
    </Link>
  );
}
