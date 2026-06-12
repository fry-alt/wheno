export type CategoryKey = "sport" | "food" | "culture" | "games" | "other";

export interface ActivityCategory {
  key: CategoryKey;
  label: string;
  emoji: string;
  color: string; // hex, also used for map markers
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  { key: "sport", label: "Спорт", emoji: "🏃", color: "#34c759" },
  { key: "food", label: "Еда и кофе", emoji: "☕", color: "#ff9f0a" },
  { key: "culture", label: "Культура", emoji: "🎭", color: "#bf5af2" },
  { key: "games", label: "Игры", emoji: "🎮", color: "#5b7cfa" },
  { key: "other", label: "Другое", emoji: "✨", color: "#8a8a92" },
];

const COLOR_BY_KEY = new Map(ACTIVITY_CATEGORIES.map((c) => [c.key, c.color]));

const CATEGORY_BY_SLUG: Record<string, CategoryKey> = {
  running: "sport", tennis: "sport", cycling: "sport", climbing: "sport", gym: "sport",
  yoga: "sport", football: "sport", basketball: "sport", swimming: "sport", hiking: "sport",
  coffee: "food", food: "food", cooking: "food",
  movies: "culture", music: "culture", concerts: "culture", art: "culture",
  reading: "culture", photography: "culture", dancing: "culture", languages: "culture",
  boardgames: "games", videogames: "games",
  travel: "other",
};

export function categoryForType(type: string): CategoryKey {
  return CATEGORY_BY_SLUG[type] ?? "other";
}

export function categoryColor(key: CategoryKey): string {
  return COLOR_BY_KEY.get(key) ?? "#8a8a92";
}

/** Empty filter ⇒ everything; otherwise keep types whose category is selected. */
export function matchesCategories(type: string, keys: CategoryKey[]): boolean {
  return keys.length === 0 || keys.includes(categoryForType(type));
}
