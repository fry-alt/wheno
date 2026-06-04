import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { getAppUrl } from "@/lib/env";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDisplayName(user: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  telegram_id?: string | null;
}) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return user.telegram_id ?? "Someone";
}

export function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");

  return initials.join("") || "W";
}

export function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function decodeSearchMessage(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function buildInviteLink(inviteCode: string) {
  return `${getAppUrl()}/join?code=${encodeURIComponent(inviteCode)}`;
}

export function buildFriendInviteLink(code: string) {
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const app = process.env.NEXT_PUBLIC_TELEGRAM_MINIAPP;
  if (bot && app) {
    return `https://t.me/${bot}/${app}?startapp=${encodeURIComponent(code)}`;
  }
  return `${getAppUrl()}/friends?invite=${encodeURIComponent(code)}`;
}

export function createErrorRedirect(
  pathname: string,
  params: Record<string, string | undefined> = {},
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `${pathname}?${query}` : pathname;
}
