import { createHmac, timingSafeEqual } from "node:crypto";

import { getSupabaseServiceRoleKey, getTelegramBotToken, isProduction } from "@/lib/env";
import type { SessionPayload } from "@/lib/types";

export const SESSION_COOKIE_NAME = "wheno_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getSessionSecret() {
  try {
    return getTelegramBotToken();
  } catch {
    return getSupabaseServiceRoleKey();
  }
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export function createSessionCookie(payload: Omit<SessionPayload, "issuedAt">) {
  const fullPayload: SessionPayload = {
    ...payload,
    issuedAt: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = signValue(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function parseSessionCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (Date.now() - payload.issuedAt > SESSION_MAX_AGE * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieConfig() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
