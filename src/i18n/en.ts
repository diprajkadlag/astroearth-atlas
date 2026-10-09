/**
 * English interface text. Every user-facing string lives in a file like this
 * one, so that Hindi, Marathi and German can follow in version 1.1.
 * Placeholders in braces, for example {date}, are filled by t().
 */
export const en = {
  appName: "Medini Atlas",
  tagline: "The sidereal sky beside world history, from 1900 to 2050.",
  disclaimer:
    "Medini Atlas shows calculated sky positions and traditional Jyotish rules. It does not predict events, and it is not advice of any kind.",
  creditsEarth:
    "Earth images: NASA Earth Observatory (Blue Marble Next Generation, and Black Marble 2016).",

  // Header
  ayanamsa: "Lahiri ayanamsa {value}",
  timeOfDay: "Time {time}",
  futureBanner: "Future dates show calculated sky positions only.",

  // Scene
  sceneTitle: "Earth and sky",
  sceneLabel:
    "The Earth inside the nakshatra ring on {date}. The sky table lists the same positions as text.",
  notToScale: "Not to scale",
  sceneHelp: "Drag to turn the view. Scroll or pinch to zoom.",
  touchUnlock: "Touch to turn the view",
  touchUnlockLabel: "Turn on touch control of the 3D view. Until then, a swipe here scrolls the page.",
  touchLock: "Lock the view",
  touchLockLabel: "Turn off touch control of the 3D view, so that a swipe scrolls the page again.",
  webglChecking: "Checking 3D graphics support.",
  webglUnavailableTitle: "The 3D view is not available",
  webglUnavailableBody:
    "This browser could not start WebGL graphics. The sky table shows the same positions.",
  webglLost: "The 3D view stopped. Restarting it.",
  webglRetry: "Try the 3D view again",

  // Sky table
  skyTitle: "Sky at {time}",
  skyNote:
    "Each scale runs from Aries to Pisces. The mark is the graha's sidereal longitude. Rahu and Ketu are the mean nodes.",
  retrogradeShort: "R",
  retrograde: "retrograde",
  pada: "pada {pada}",
  kalaSarpa: "Kala Sarpa: all 7 grahas lie on one side of the Rahu-Ketu axis.",

  // Timeline
  timelineTitle: "Planetary time waves",
  timelineHelp: "Click or drag on the lanes to set the date. Ctrl and the mouse wheel zoom.",
  play: "Play",
  pause: "Pause",
  speed: "Speed",
  speedOption: "{days} days per second",
  speedOptionOne: "1 day per second",
  today: "Today",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  dateSlider: "Date",
  lanesLabel:
    "Sidereal longitude of {grahas}, from {start} to {end}. Each lane runs from 0 degrees at the bottom to 360 degrees at the top.",
  laneRahuKetu: "Rahu and Ketu",
  moonLaneHidden: "The Moon lane shows at spans of 2 years or less.",
} as const;

export type MessageKey = keyof typeof en;
