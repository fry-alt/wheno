import type { ActivityButtonState, ActivityStatus } from "./types";

export function isFull(count: number, capacity: number | null): boolean {
  return capacity != null && count >= capacity;
}

export interface Interval { starts_at: string; ends_at: string }

export function isFreeDuring(events: Interval[], start: string, end: string): boolean {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return !events.some((ev) => new Date(ev.starts_at).getTime() < e && new Date(ev.ends_at).getTime() > s);
}

export interface JoinCtx {
  isHost: boolean; isParticipant: boolean; count: number; capacity: number | null;
  status: ActivityStatus; startsAt: string; now: string; blocked: boolean;
}

export function canJoin(ctx: JoinCtx): { ok: true } | { ok: false; reason: string } {
  if (ctx.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (new Date(ctx.startsAt).getTime() <= new Date(ctx.now).getTime()) return { ok: false, reason: "past" };
  if (ctx.blocked) return { ok: false, reason: "blocked" };
  if (ctx.isHost) return { ok: false, reason: "host" };
  if (ctx.isParticipant) return { ok: false, reason: "joined" };
  if (isFull(ctx.count, ctx.capacity)) return { ok: false, reason: "full" };
  return { ok: true };
}

export interface ButtonCtx {
  isHost: boolean; isParticipant: boolean; count: number; capacity: number | null;
  status: ActivityStatus; startsAt: string; now: string;
}

export function activityButtonState(ctx: ButtonCtx): ActivityButtonState {
  if (ctx.status === "cancelled") return "cancelled";
  if (ctx.isHost) return "host";
  if (ctx.isParticipant) return "joined";
  if (new Date(ctx.startsAt).getTime() <= new Date(ctx.now).getTime()) return "past";
  if (isFull(ctx.count, ctx.capacity)) return "full";
  return "join";
}
