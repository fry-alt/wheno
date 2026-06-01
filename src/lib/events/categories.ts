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

export function categoryEmoji(c: string): string {
  return CATEGORY_EMOJI[c as Category] ?? "📌";
}

export function isCategory(value: string): value is Category {
  return (CATEGORIES as string[]).includes(value);
}
