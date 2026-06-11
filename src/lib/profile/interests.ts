export interface InterestTag { slug: string; emoji: string; label: string }

export const INTEREST_TAGS: InterestTag[] = [
  { slug: "running", emoji: "🏃", label: "Бег" },
  { slug: "tennis", emoji: "🎾", label: "Теннис" },
  { slug: "cycling", emoji: "🚴", label: "Велосипед" },
  { slug: "climbing", emoji: "🧗", label: "Скалолазание" },
  { slug: "gym", emoji: "🏋️", label: "Зал" },
  { slug: "yoga", emoji: "🧘", label: "Йога" },
  { slug: "football", emoji: "⚽", label: "Футбол" },
  { slug: "basketball", emoji: "🏀", label: "Баскетбол" },
  { slug: "swimming", emoji: "🏊", label: "Плавание" },
  { slug: "coffee", emoji: "☕", label: "Кофе" },
  { slug: "food", emoji: "🍽️", label: "Еда" },
  { slug: "cooking", emoji: "👨‍🍳", label: "Готовка" },
  { slug: "movies", emoji: "🎬", label: "Кино" },
  { slug: "music", emoji: "🎵", label: "Музыка" },
  { slug: "concerts", emoji: "🎤", label: "Концерты" },
  { slug: "travel", emoji: "✈️", label: "Путешествия" },
  { slug: "boardgames", emoji: "🎲", label: "Настолки" },
  { slug: "videogames", emoji: "🎮", label: "Игры" },
  { slug: "hiking", emoji: "🥾", label: "Хайкинг" },
  { slug: "photography", emoji: "📷", label: "Фото" },
  { slug: "art", emoji: "🎨", label: "Искусство" },
  { slug: "reading", emoji: "📚", label: "Чтение" },
  { slug: "dancing", emoji: "💃", label: "Танцы" },
  { slug: "languages", emoji: "🗣️", label: "Языки" },
];

const BY_SLUG = new Map(INTEREST_TAGS.map((t) => [t.slug, t]));
const MAX_INTERESTS = 12;

export function isInterestSlug(s: string): boolean {
  return BY_SLUG.has(s);
}

export function interestLabel(s: string): string {
  const tag = BY_SLUG.get(s);
  return tag ? `${tag.emoji} ${tag.label}` : s;
}

export function normalizeInterests(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = isInterestSlug(item) ? item : item.trim();
    if (!value) continue;
    if (!out.includes(value)) out.push(value);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}
