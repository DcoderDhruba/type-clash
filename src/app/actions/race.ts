"use server";

import { redirect } from "next/navigation";
import { isValidAmount } from "@/lib/config";
import { findUserByUsername, getCurrentUser } from "@/server/auth";
import { createRace } from "@/server/races";

/** Creates a challenge (1v1) or a race (multiplayer) from the form and sends the creator to its page. */
export async function createChallenge(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fchallenge");

  const mode = formData.get("mode");
  const amount = Number(formData.get("amount"));
  if ((mode !== "time" && mode !== "words") || !isValidAmount(mode, amount)) redirect("/challenge");

  // A challenge aimed at one person can only be a duel, and only they can accept it.
  const to = formData.get("to");
  let invitedUserId: number | undefined;
  if (typeof to === "string" && to !== "") {
    const target = findUserByUsername(to);
    if (!target || target.id === user.id) redirect("/challenge");
    invitedUserId = target.id;
  }
  const kind = invitedUserId !== undefined || formData.get("kind") === "duo" ? "duo" : "multi";

  const id = createRace(user.id, mode, amount, kind, invitedUserId);
  if (!id) redirect("/challenge");
  redirect(`/race/${id}`);
}
