export function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`${name} is not set.`);
}

export function getSupabaseUrl() {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getTelegramBotToken() {
  return getRequiredEnv("TELEGRAM_BOT_TOKEN");
}

export function getOpenAiApiKey() {
  return getRequiredEnv("OPENAI_API_KEY");
}

export function getTelegramWebhookSecret() {
  return getRequiredEnv("TELEGRAM_WEBHOOK_SECRET", "");
}

export function getAppUrl() {
  return getRequiredEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function getCronSecret() {
  return getRequiredEnv("CRON_SECRET", "");
}
