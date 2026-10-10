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
  fullscreenEnter: "Full screen",
  fullscreenExit: "Exit full screen",
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
  timelineHelp:
    "Click to set the date or to open an event. Drag to move along the timeline. Ctrl or Cmd with the mouse wheel zooms.",
  cyclesHelp:
    "Each wave is the cosine of the angle between 2 grahas: +1 at a conjunction, 0 at a square, −1 at an opposition.",
  viewChoice: "Timeline view",
  viewLanes: "Lanes",
  viewCycles: "Cycles",
  live: "Live",
  previousEvent: "Previous event",
  nextEvent: "Next event",
  lanesChoose: "Choose lanes",
  lanesMoonNote: "The Moon lane shows at spans of 2 years or less.",
  pairsChoose: "Choose pairs",
  pairsLimit: "Choose up to {count} pairs.",
  pairName: "{a} and {b}",
  cyclesLabel:
    "Cycles of {pairs}, from {start} to {end}: the cosine of the angle between each pair, from −1 to +1.",
  cycleConjunction: "Conjunction",
  cycleSquare: "Square",
  cycleOpposition: "Opposition",
  moonPairHidden: "Pairs with the Moon show at spans of 2 years or less.",
  rulerHelp:
    "The arrow keys step by the zoom unit, Page Up and Page Down by 10 units. Home and End go to 1900 and 2050. Space plays and pauses.",
  legendTitle: "Marks on the timeline",
  legendKalaSarpa: "Kala Sarpa",
  legendStation: "Station",
  legendConjunction: "Exact conjunction",

  // Events
  kindWorld: "World event",
  kindSolarEclipse: "Solar eclipse",
  kindLunarEclipse: "Lunar eclipse",
  kindGreatConjunction: "Jupiter–Saturn conjunction",
  eclipseSolarTotal: "Total solar eclipse",
  eclipseSolarAnnular: "Annular solar eclipse",
  eclipseSolarPartial: "Partial solar eclipse",
  eclipseSolarHybrid: "Hybrid solar eclipse",
  eclipseLunarTotal: "Total lunar eclipse",
  eclipseLunarPartial: "Partial lunar eclipse",
  eclipseLunarPenumbral: "Penumbral lunar eclipse",
  greatConjunctionTitle: "Jupiter–Saturn conjunction in {sign}",
  greatConjunctionAt: "Jupiter and Saturn meet at {degree} {sign} in the sidereal zodiac.",
  eclipseSunIn: "The Sun stands in {nakshatra}.",
  eclipseMoonIn: "The Moon stands in {nakshatra}.",
  eclipseCentralPeak: "Peak of the central line: {place}.",
  eclipseNoCentralLine: "No central line. The globe shows the sub-solar point at peak: {place}.",
  eclipseSubLunar: "The globe shows the sub-lunar point at peak: {place}.",
  categoryHealth: "Pandemic and health",
  categoryConflict: "War and conflict",
  categoryDisaster: "Disaster",
  categoryPolitics: "Politics",
  categoryScience: "Science and technology",
  categoryFilter: "Category",
  categoryAll: "All categories",
  eventsTitle: "Events",
  eventNone: "Choose an event on the timeline or in the list to see its card.",
  eventClose: "Close",
  eventSource: "Source: Wikidata {id}",
  eventCalculated: "Calculated with astronomy-engine.",
  shownAtLocalNoon: "Shown at local noon ({time}).",
  shownAtNoonUtc: "Shown at 12:00 UTC.",
  moonRange: "During that day the Moon moved from {from} to {to}.",
  moonPlacement: "{sign} {degree} ({nakshatra})",
  momentsTitle: "Sky moments",
  momentEightCapricorn: "Eight grahas in Capricorn",
  momentSixSagittarius: "Six grahas in Sagittarius",
  momentGreatConjunction: "Great conjunction in Capricorn",
  worldEventsTitle: "World events",
  worldEventsEmpty: "No world event in this category.",

  // Rules
  rulesConjunctions: "Conjunctions (yuti)",
  rulesWar: "Planetary war (graha yuddha)",
  rulesCombust: "Combust (asta)",
  rulesAspects: "Aspects (graha drishti)",
  ruleNone: "None at this date.",
  ruleConjunction: "{a} and {b}, {separation} apart.",
  ruleSameSign: "Same sign.",
  ruleWar: "{a} and {b}, {separation} apart.",
  ruleCombust: "{graha}, {separation} from the Sun (orb {orb}°).",
  ruleAspect: "{target} receives drishti from {sources}.",
  liveConjunction: "{a} and {b} in conjunction",
  liveKalaSarpa: "Kala Sarpa",
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
