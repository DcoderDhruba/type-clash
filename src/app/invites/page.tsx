import { redirect } from "next/navigation";
import { InviteList } from "@/components/InviteList";
import { PageShell } from "@/components/PageShell";
import { getCurrentUser } from "@/server/auth";
import { getPendingInvites } from "@/server/races";

export const metadata = { title: "Challenges | TypeChaze" };

export default async function InvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Finvites");

  return (
    <PageShell className="gap-5">
      <h1 className="flex items-center gap-3 text-3xl font-bold text-accent">
        <i className="bi bi-bell-fill" aria-hidden="true" />
        Challenges for you
      </h1>
      <InviteList initial={await getPendingInvites(user.id)} />
    </PageShell>
  );
}
