/**
 * Whether the draft autosave should send the current text. Nothing is sent
 * until the draft for this date has loaded: before that, an empty store is a
 * reset, not the user clearing their draft, and an empty PUT deletes it.
 */
export function shouldSave({ loaded, text, lastSaved }: { loaded: boolean; text: string; lastSaved: string }): boolean {
  return loaded && text !== lastSaved;
}
