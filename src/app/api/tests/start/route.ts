import { isValidAmount } from "@/lib/config";
import { SEED_PATTERN } from "@/lib/words";
import { getCurrentUser } from "@/server/auth";
import { isSameOrigin, json } from "@/server/http";
import { createTicket } from "@/server/tickets";

/** Registers the start of a test so its score can be verified when it is submitted. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);

  const user = await getCurrentUser();
  if (!user) return json({ error: "Log in to save scores" }, 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body !== "object" || body === null) return json({ error: "Invalid test" }, 400);

  const { seed, mode, amount, punctuation, numbers } = body;
  if (
    typeof seed !== "string" ||
    !SEED_PATTERN.test(seed) ||
    (mode !== "time" && mode !== "words") ||
    typeof amount !== "number" ||
    !isValidAmount(mode, amount) ||
    typeof punctuation !== "boolean" ||
    typeof numbers !== "boolean"
  ) {
    return json({ error: "Invalid test" }, 400);
  }

  return json({ ticketId: await createTicket(user.id, { seed, mode, amount, punctuation, numbers }) });
}
