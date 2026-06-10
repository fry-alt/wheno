import type { Category } from "./types";

export const CATEGORIES: Category[] = [
  "study", "work", "meeting", "gym", "run", "meal", "coffee", "social", "rest", "errand", "other",
];

export const CATEGORY_EMOJI: Record<Category, string> = {
  study: "📚", work: "💻", meeting: "💼", gym: "🏋️", run: "🏃",
  meal: "🍽️", coffee: "☕", social: "🎉", rest: "😴", errand: "🛒", other: "📌",
};

export const CATEGORY_DEFAULT_FIXED: Record<Category, boolean> = {
  study: true, work: true, meeting: true,
  gym: false, run: false, meal: false, coffee: false, social: false, rest: false, errand: false, other: false,
};

export const CATEGORY_LABEL_RU: Record<Category, string> = {
  study: "Учёба", work: "Работа", meeting: "Встреча", gym: "Зал", run: "Бег",
  meal: "Еда", coffee: "Кофе", social: "Тусовка", rest: "Отдых", errand: "Дела", other: "Другое",
};

export const CATEGORY_COLOR: Record<Category, string> = {
  study: "#8b5cf6",   // violet
  work: "#3b82f6",    // blue
  meeting: "#6366f1", // indigo
  gym: "#ef4444",     // red
  run: "#22c55e",     // green
  meal: "#f59e0b",    // amber
  coffee: "#d97706",  // dark amber
  social: "#ec4899",  // pink
  rest: "#14b8a6",    // teal
  errand: "#eab308",  // yellow
  other: "#94a3b8",   // slate
};

export function categoryEmoji(c: string): string {
  return CATEGORY_EMOJI[c as Category] ?? "📌";
}

export function categoryColor(c: string): string {
  return CATEGORY_COLOR[c as Category] ?? CATEGORY_COLOR.other;
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as string[]).includes(value);
}
