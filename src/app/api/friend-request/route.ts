import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  findUserIdByInviteCode,
  findFriendshipBetween,
  createPendingRequest,
} from "@/lib/friends/queries";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!code || !code.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const inviterId = await findUserIdByInviteCode(code.trim());
  if (!inviterId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (inviterId === user.id) return NextResponse.json({ ok: true, self: true });

  const existing = await findFriendshipBetween(inviterId, user.id);
  if (existing) return NextResponse.json({ ok: true, existing: true });

  await createPendingRequest(inviterId, user.id);
  return NextResponse.json({ ok: true });
}
