import { notFound, redirect } from "next/navigation";
import { RaceRoom } from "@/components/RaceRoom";
import { getCurrentUser } from "@/server/auth";
import { getRaceView } from "@/server/races";

export const metadata = {
  title: "Typing Race",
  robots: { index: false, follow: false },
};

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/race/${id}`)}`);

  const view = await getRaceView(id, user.id, { includeWords: true });
  if (!view) notFound();

  return <RaceRoom initial={view} />;
}
