import type { DraftSource } from "@/types";

/**
 * Whether the draft autosave should send the current text. Nothing is sent
 * until the draft for this date has loaded: before that, an empty store is a
 * reset, not the user clearing their draft, and an empty PUT deletes it.
 * A change of source alone is saved too, so a reload restores it.
 */
export function shouldSave({
  loaded,
  text,
  lastSaved,
  source = "manual",
  lastSource = "manual",
}: {
  loaded: boolean;
  text: string;
  lastSaved: string;
  source?: DraftSource;
  lastSource?: DraftSource;
}): boolean {
  return loaded && (text !== lastSaved || (text !== "" && source !== lastSource));
}
