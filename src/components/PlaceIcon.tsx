const PLACES: Record<number, { icon: string; label: string }> = {
  1: { icon: "👑", label: "first place" },
  2: { icon: "🥈", label: "second place" },
  3: { icon: "🥉", label: "third place" },
};

/** A crown for first place, medals for second and third, nothing after that. */
export function PlaceIcon({ place }: { place: number | null }) {
  const found = place === null ? undefined : PLACES[place];
  if (!found) return null;
  return (
    <span role="img" aria-label={found.label} title={found.label} className="ml-2 align-middle text-xl leading-none">
      {found.icon}
    </span>
  );
}
