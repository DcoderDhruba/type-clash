import { getCurrentUser } from "@/server/auth";
import { isSameOrigin, json } from "@/server/http";
import {
  cancelRace,
  declineRace,
  finishRace,
  getRaceView,
  joinRace,
  leaveRace,
  parseFinish,
  parseProgress,
  reportProgress,
  setReady,
  startRace,
  startRematch,
} from "@/server/races";
import type { RaceError } from "@/server/races";

const ERROR_STATUS: Record<RaceError, number> = {
  not_found: 404,
  forbidden: 403,
  full: 409,
  closed: 409,
  invalid: 422,
  too_early: 409,
  need_players: 409,
  not_ready: 409,
  not_invited: 403,
};

const ERROR_MESSAGE: Record<RaceError, string> = {
  not_found: "This race does not exist.",
  forbidden: "You cannot do that in this race.",
  full: "This race is full.",
  closed: "This race has already started or is no longer open.",
  invalid: "That result was rejected.",
  too_early: "The race is not over yet.",
  need_players: "Wait for at least one more player to join before starting.",
  not_ready: "Everyone has to click Ready before you can start.",
  not_invited: "This challenge was sent to someone else.",
};

function failure(error: RaceError, reason?: string): Response {
  return json({ error: error, message: reason ?? ERROR_MESSAGE[error] }, ERROR_STATUS[error]);
}

export async function GET(request: Request, ctx: RouteContext<"/api/race/[id]">) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { id } = await ctx.params;
  const includeWords = new URL(request.url).searchParams.get("words") === "1";
  const view = await getRaceView(id, user.id, { includeWords });
  return view ? json(view) : failure("not_found");
}

export async function POST(request: Request, ctx: RouteContext<"/api/race/[id]">) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const user = await getCurrentUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body !== "object" || body === null) return json({ error: "invalid" }, 400);

  switch (body.action) {
    case "join": {
      const result = await joinRace(id, user.id);
      if ("error" in result) return failure(result.error);
      return json(await getRaceView(id, user.id, { includeWords: true }));
    }
    case "decline": {
      const result = await declineRace(id, user.id);
      if ("error" in result) return failure(result.error);
      return json(await getRaceView(id, user.id));
    }
    case "rematch": {
      const result = await startRematch(id, user.id);
      if ("error" in result) return failure(result.error);
      return json({ rematchId: result.rematchId });
    }
    case "leave": {
      const result = await leaveRace(id, user.id);
      if ("error" in result) return failure(result.error);
      return json(await getRaceView(id, user.id));
    }
    case "ready": {
      if (typeof body.ready !== "boolean") return json({ error: "invalid" }, 400);
      const result = await setReady(id, user.id, body.ready);
      if ("error" in result) return failure(result.error);
      return json(await getRaceView(id, user.id));
    }
    case "start": {
      const result = await startRace(id, user.id);
      if ("error" in result) return failure(result.error);
      return json(await getRaceView(id, user.id));
    }
    case "cancel": {
      const result = await cancelRace(id, user.id);
      if ("error" in result) return failure(result.error);
      return json(await getRaceView(id, user.id));
    }
    case "progress": {
      const progress = parseProgress(body);
      if (!progress) return json({ error: "invalid" }, 400);
      await reportProgress(id, user.id, progress);
      const view = await getRaceView(id, user.id);
      return view ? json(view) : failure("not_found");
    }
    case "finish": {
      const log = parseFinish(body);
      if (!log) return json({ error: "invalid" }, 400);
      const result = await finishRace(id, user.id, log);
      if ("error" in result) return failure(result.error, result.reason);
      return json(await getRaceView(id, user.id));
    }
    default:
      return json({ error: "invalid" }, 400);
  }
}
