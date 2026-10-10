import type { NakshatraName } from "../engine/zodiac.ts";

/**
 * Devanagari names of the nakshatras, shown as a second label in the sky
 * table (DESIGN.md, decision on names). The spellings come from VedicAstrologer
 * (same author, MIT). Compounds are written as one word, and Mrigashira as
 * मृगशिरा, so each name has one form beside its Latin spelling.
 */
export const NAKSHATRA_DEVANAGARI: Readonly<Record<NakshatraName, string>> = {
  Ashwini: "अश्विनी",
  Bharani: "भरणी",
  Krittika: "कृत्तिका",
  Rohini: "रोहिणी",
  Mrigashira: "मृगशिरा",
  Ardra: "आर्द्रा",
  Punarvasu: "पुनर्वसु",
  Pushya: "पुष्य",
  Ashlesha: "आश्लेषा",
  Magha: "मघा",
  "Purva Phalguni": "पूर्वफाल्गुनी",
  "Uttara Phalguni": "उत्तरफाल्गुनी",
  Hasta: "हस्त",
  Chitra: "चित्रा",
  Swati: "स्वाती",
  Vishakha: "विशाखा",
  Anuradha: "अनुराधा",
  Jyeshtha: "ज्येष्ठा",
  Mula: "मूल",
  "Purva Ashadha": "पूर्वाषाढा",
  "Uttara Ashadha": "उत्तराषाढा",
  Shravana: "श्रवण",
  Dhanishtha: "धनिष्ठा",
  Shatabhisha: "शतभिषा",
  "Purva Bhadrapada": "पूर्वभाद्रपदा",
  "Uttara Bhadrapada": "उत्तरभाद्रपदा",
  Revati: "रेवती",
};
