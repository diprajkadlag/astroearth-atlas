/**
 * English interface text. Every user-facing string lives in a file like this
 * one, so that Hindi, Marathi and German can follow in version 1.1.
 */
export const en = {
  appName: "Medini Atlas",
  tagline: "The sidereal sky beside world history, from 1900 to 2050.",
  globeTitle: "Earth and sky",
  skyTitle: "Sky on this date",
  timelineTitle: "Planetary time waves",
  inDevelopment: "This part is in development.",
  disclaimer:
    "Medini Atlas shows calculated sky positions and traditional Jyotish rules. It does not predict events, and it is not advice of any kind.",
} as const;

export type MessageKey = keyof typeof en;
