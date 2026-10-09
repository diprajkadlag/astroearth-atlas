import { en, type MessageKey } from "./en.ts";

/** Returns the interface text for a key. English is the only language in version 1. */
export function t(key: MessageKey): string {
  return en[key];
}
