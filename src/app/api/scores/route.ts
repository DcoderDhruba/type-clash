import { getCurrentUser } from "@/server/auth";
import { isSameOrigin, json } from "@/server/http";
import { parseScoreSubmission, submitVerifiedScore } from "@/server/scores";

// A long test's typing log is a few thousand numbers; anything much bigger is not a real test.
const MAX_BODY_BYTES = 400_000;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: "Forbidden" }, 403);

  const user = await getCurrentUser();
  if (!user) return json({ error: "Log in to save scores" }, 401);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Too large" }, 413);

  const submission = parseScoreSubmission(await request.json().catch(() => null));
  if (!submission) return json({ error: "Invalid score" }, 400);

  const result = submitVerifiedScore(user.id, submission);
  if (!result.ok) return json({ error: "Score rejected", reason: result.reason }, result.status);

  return json(result.saved);
}
