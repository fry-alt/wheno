import { parse, validate } from "@telegram-apps/init-data-node";

import { getTelegramBotToken, isProduction } from "@/lib/env";
import type { TelegramProfile } from "@/lib/types";

type ParsedTelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

const DEFAULT_TIMEZONE = "Europe/Amsterdam";

export function normalizeTimezone(timezone?: string | null) {
  return timezone?.trim() || DEFAULT_TIMEZONE;
}

export function getDevTelegramProfile(timezone?: string | null): TelegramProfile {
  return {
    telegramId: "dev-user",
    firstName: "Dev",
    lastName: null,
    username: "dev",
    photoUrl: null,
    timezone: normalizeTimezone(timezone),
  };
}

function mapTelegramUser(
  user: ParsedTelegramUser,
  timezone?: string | null,
): TelegramProfile {
  return {
    telegramId: String(user.id),
    firstName: user.first_name,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
    photoUrl: user.photo_url ?? null,
    timezone: normalizeTimezone(timezone),
  };
}

export function resolveTelegramProfile({
  initDataRaw,
  isTMA,
  timezone,
}: {
  initDataRaw?: string;
  isTMA?: boolean;
  timezone?: string | null;
}) {
  if (initDataRaw) {
    validate(initDataRaw, getTelegramBotToken(), { expiresIn: 60 * 60 });

    const parsed = parse(initDataRaw) as { user?: ParsedTelegramUser };

    if (!parsed.user) {
      throw new Error("Telegram did not send a user profile for this Mini App session.");
    }

    return mapTelegramUser(parsed.user, timezone);
  }

  if (isProduction()) {
    if (isTMA) {
      throw new Error(
        "Telegram opened wheno without Mini App credentials. Launch it from the bot's Menu Button or Web App button.",
      );
    }

    throw new Error(
      "Open wheno from your bot's Mini App button in Telegram, not as a regular link.",
    );
  }

  return getDevTelegramProfile(timezone);
}
