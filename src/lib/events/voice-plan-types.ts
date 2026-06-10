import type { ParsedEvent } from "./types";

export type TargetScope = "one" | "all";

export interface EventContextItem {
  id: string;
  recurring: boolean;
  date: string;  // yyyy-MM-dd (occurrence date)
  start: string; // HH:mm
  title: string;
  category: string;
}

export interface CreateAction {
  type: "create";
  event: ParsedEvent;
}
export interface NoteAction {
  type: "note";
  date: string;
  text: string;
}
export interface EditAction {
  type: "edit";
  targetId: string;
  recurring: boolean;
  scope: TargetScope;
  targetDate: string | null; // occurrence date when scope === "one"
  targetTitle: string;       // original title, for display
  event: ParsedEvent;        // new state
}
export interface DeleteAction {
  type: "delete";
  targetId: string;
  recurring: boolean;
  scope: TargetScope;
  targetDate: string | null;
  targetTitle: string;
}

export type VoiceAction = CreateAction | NoteAction | EditAction | DeleteAction;
