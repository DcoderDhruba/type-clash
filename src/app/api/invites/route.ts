import { getCurrentUser } from "@/server/auth";
import { json } from "@/server/http";
import { getPendingInvites } from "@/server/races";

/** The challenges waiting for the logged-in player. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  return json({ invites: getPendingInvites(user.id) });
}
