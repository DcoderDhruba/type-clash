// Same page width as the typing page: the gutter sits on the outer element so the
// max-w-7xl content box is the full 80rem, not 80rem minus the padding.
export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8 pt-2">
      <div className={`mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col ${className}`}>{children}</div>
    </div>
  );
}
