# Design rules

Medini Atlas uses the **Yantra** direction: the app is an observatory
instrument for reading the sky against time. The user chose it on 2026-10-09
from 3 directions on a private design canvas (Yantra, Panchang and Akasha).
Fable reviewed the canvas and recommended Yantra.

Read this file before any change to the interface. The tokens are in
`src/design/tokens.css` (CSS) and `src/design/palette.ts` (canvas and WebGL).
`tests/design-tokens.test.ts` keeps the 2 files equal and checks contrast.

## 1. Idea

- The source is the masonry instruments of the Jantar Mantar observatories:
  engraved scales, gnomon shadows and brass fittings.
- The signature element is the date scrub. When the date moves, the
  nakshatra ring turns, the Earth turns and the Koorma regions glow.
- Spend boldness only on the ring and the date cursor. Keep panels plain.
- Every line and label must carry information. Remove decoration that does
  not.

## 2. Decisions of 2026-10-09

| Topic | Rule |
|---|---|
| Earth motion | For a step under 1 day (a zoomed timeline, live mode), the Earth shows the true time of day. For a step of 1 day or more (day steps, play at 1 day per second or faster), the Earth shows 00:00 UTC of the date. The sky ring always shows the true instant. |
| Koorma Chakra | The global mode shows first, with the label "modern extension". The classical mode is one click away. The centre region has a radius of 5.5 degrees around Mathura. |
| Koorma glow | 3 strengths. A legend gives the reason for each lit region. Strongest: an eclipse in the region's nakshatra (eclipse ivory). Middle: a station or a retrograde malefic (brass). Soft: a transit of Saturn, Mars, Rahu or Ketu (brass at 50 %). |
| Names | English sign names (Aries). Sanskrit nakshatra names in Latin script, without diacritics (Krittika). The sidebar adds the Devanagari name as a second label (Krittika कृत्तिका). |
| World events | Neutral titles with the label "World event". No scores and no rankings. |
| Ring labels | All 27 nakshatra names when the scene is at least 700 px wide. Below that, only the names of lit nakshatras. Sign names outside the ring when the scene is at least 480 px wide. |
| Lanes | Desktop shows 5 lanes: Saturn, Jupiter, Rahu and Ketu, Mars, Sun. Phones show 3: Saturn, Jupiter, Rahu and Ketu. The others can be opened. |
| Stars | No decorative stars. Real stars only from a public-domain catalogue (Yale Bright Star Catalogue), and only with a job, for example the yogatara of each nakshatra. |
| First load | The app opens on today at 00:00 UTC, unless the link holds a date. |

## 3. Colour

### Surfaces and ink

| Token | Hex | Job | Contrast on ground / dial / raised |
|---|---|---|---|
| `ground` | `#0e1330` | Night indigo: the page | surface |
| `dial` | `#070a1c` | Dial ink: the instrument plate behind the scene | surface |
| `raised` | `#151b3d` | Tooltips, the event card, table headers | surface |
| `ivory` | `#eae3d2` | Plaster ivory: text and engraved lines | 14.2 / 15.4 / 13.1 |
| `muted` | `#a8a493` | Secondary text | 7.3 / 7.9 / 6.7 |
| `rule` | ivory at 16 % | Hairlines between rows | not text |
| `rule-strong` | ivory at 32 % | Scale baselines, input borders | not text |
| `brass` | `#c9a25e` | The date cursor, focus, the primary action, the Koorma glow | 7.6 / 8.2 / 7.0 |
| `eclipse` | `#f6eeda` | Reserved for eclipses | 15.7 / 17.0 / 14.5 |

- Each accent has one job. Do not use brass or eclipse ivory for anything
  else.
- Text uses `ivory`, `muted` or `brass` only. Never write text in a graha
  colour.
- Do not use gradients as decoration. The atmosphere rim and the day-night
  terminator on the Earth are physical, so they may use gradients.

### Graha colours

The 8 hue families of the validated categorical palette (the dataviz
reference, dark steps), one per graha, in the fixed slot order:

| Slot | Graha | Token | Hex |
|---|---|---|---|
| 1 | Moon | `graha-moon` | `#3987e5` |
| 2 | Sun | `graha-sun` | `#d95926` |
| 3 | Rahu and Ketu (verdigris) | `graha-nodes` | `#199e70` |
| 4 | Jupiter | `graha-jupiter` | `#c98500` |
| 5 | Venus | `graha-venus` | `#d55181` |
| 6 | Mercury | `graha-mercury` | `#008300` |
| 7 | Saturn | `graha-saturn` | `#9085e9` |
| 8 | Mars | `graha-mars` | `#e66767` |

Validator results on 2026-10-09, for both `#0e1330` and `#070a1c`:

- Lightness band (OKLCH L 0.48 to 0.67): all 8 pass.
- Chroma floor (0.10): all 8 pass.
- Colour-blind separation of adjacent slots: worst ΔE 8.4 (Jupiter and the
  nodes, protanopia). The target is 8.
- Normal-vision floor of adjacent slots: worst ΔE 19.3 (Venus and Jupiter).
  The floor is 15.
- Contrast: all 8 are at least 3:1 on every surface (lowest: Mercury, 3.4:1
  on `raised`).
- All pairs (8 marks on one ring): this check fails, as expected for 8
  series. Venus and the nodes have ΔE 1.6 under deuteranopia. Mars and the Sun
  have ΔE 7.1 for all readers.

Rules that follow from the results:

- Identity never rests on colour alone. Every graha mark carries a label: the
  lane name, the ring abbreviation (Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke) or the
  name in the sky table.
- The Sun mark has rays. Mars is a plain disc. The nodes are drawn as an axis.
- Ketu uses the Rahu hue with a dotted line.
- A colour follows its graha. A filter never repaints the remaining grahas.
- After any colour change, run the validator again for both surfaces:

  ```
  node <dataviz skill>/scripts/validate_palette.js "#3987e5,#d95926,#199e70,#c98500,#d55181,#008300,#9085e9,#e66767" --mode dark --surface "#0E1330"
  ```

## 4. Type

| Family | Role | Files |
|---|---|---|
| Tiro Devanagari Sanskrit 400 | Display: the app title, the date, section titles | `public/fonts/tiro-devanagari-sanskrit` |
| Anek Devanagari 100 to 800 | Interface: all other text, numbers, Devanagari labels | `public/fonts/anek-devanagari` |

Both fonts are self-hosted under the SIL Open Font License 1.1 (see
CREDITS.md). Do not load a font from another origin.

| Token | Size / line height | Use |
|---|---|---|
| `text-caption` | 12 / 16 px | Canvas and WebGL labels, axis labels, "Not to scale" |
| `text-small` | 13 / 18 px | Notes under a title, the footer, preset dates |
| `text-body` | 15 / 22 px | The default |
| `text-lead` | 17 / 24 px | The tithi line under the date |
| `text-title-3` | 18 / 24 px | Small section titles (display face) |
| `text-title-2` | 22 / 28 px | Section titles (display face) |
| `text-title-1` | 30 / 36 px | The app title (display face) |
| `text-date` | 44 / 48 px | The date (display face) |

- Write in sentence case. Do not use all-caps labels or letter-spaced
  eyebrows above titles.
- Use tabular figures (`tabular-nums`) for degrees, dates and table numbers.
- Write degrees as 6°18′, with the degree sign and the prime.
- The smallest text is 12 px, also in canvases and WebGL.
- Keep prose lines under 80 characters.
- Do not put one word of a title in italic, bold or another colour.

## 5. Layout and shape

- Desktop (1024 px and wider): a header with the title and the date. Below it,
  a grid with the scene (3 fr) and the sky table (2 fr). The timeline spans
  the full width below the grid.
- Phone: the header, the scene (300 px high), a row with Play and the date
  slider, 3 lanes (150 px), the sky list, and a 1-line disclaimer.
- No horizontal scrolling down to 320 px.
- Spacing steps: 4, 8, 12, 16, 24, 32 and 48 px.
- Radius: 3 px (`rounded-control`) for buttons and inputs. 0 for panels,
  tables and rules. Circles only for the dial, graha marks and colour dots. No
  pill buttons.
- Group with space and hairlines. No cards with shadows.
- Touch targets are at least 44 px on phones.

## 6. The scene

- The scene sits on the `dial` plate.
- The ring is an engraved scale in ivory: 360 degree ticks (each 5th one
  longer), 27 nakshatra ticks and 12 sign ticks (the longest). Lit nakshatra
  arcs are brass, or eclipse ivory for an eclipse.
- Longitude increases counter-clockwise, seen from ecliptic north (scene +Z).
- The Rahu-Ketu axis is a verdigris line through the Earth.
- A "Not to scale" label sits in a corner of the scene (caption, muted).
- The camera starts about 24 degrees above the ecliptic.
- The Earth uses NASA Blue Marble (day) and Black Marble (night) images, a
  terminator from the Sun direction and a thin atmosphere rim. No political
  borders. Koorma regions are soft glows, not lines.

## 7. Timeline

- The lanes are small multiples: one graha per lane. The y axis is sidereal
  longitude from 0 to 360 degrees, with 12 faint sign bands.
- A line breaks at the 360-to-0 wrap. Retrograde parts are thicker. Stations
  are triangles. Exact conjunctions are dots.
- The date cursor is a brass line across all lanes. The hover line is ivory at
  50 %.
- The time axis has a tick each month, a label each quarter and the year in
  bold.
- The sky table is the table view of the chart.

## 8. Motion

- One orchestrated moment: on first load, the ring ticks draw in, then the
  camera settles on the Earth, in under 1.2 seconds.
- All other motion answers an action of the user.
- The date follows the pointer with no easing.
- Interface transitions take 150 to 200 ms with ease-out. Panels have no hover
  animation.
- Playback runs on `requestAnimationFrame`. The date cursor is an overlay, so
  playback does not redraw the lanes.
- With reduced motion: no intro, no camera glide and no glow pulse. Playback
  still works, because the user starts it.

## 9. Accessibility floor

- Text contrast is at least 4.5:1. Marks are at least 3:1.
- Focus is visible: a 2 px brass outline with a 2 px offset.
- Every control works by keyboard. The date slider follows the WAI-ARIA
  slider pattern. The arrow keys step by the zoom unit. Page Up and Page Down
  step by 10 units. Home and End go to the limits. Space plays and pauses.
  `aria-valuetext` reads the date.
- A polite live region summarises the sky at most once per second.
- The sky table is the text alternative of the 3D scene.

## 10. Ban lists

From Anthropic's frontend guide for Opus 5.5:

- a cream or off-white background;
- an italic accent word in a headline;
- numbered 01 / 02 / 03 labels on content that is not a sequence;
- monospace labels;
- pill-shaped buttons.

From the frontend-design skill:

- cream with terracotta or clay;
- near-black with one acid accent;
- broadsheet columns with hairline rules everywhere;
- identical rounded cards with the same grey shadow;
- all-caps eyebrow labels;
- meta strings joined with middle dots ("A · B · C");
- "→" after link and button text;
- gradient washes as decoration.

Project rules:

- no political borders on the globe;
- no NASA logo, and no claim of endorsement;
- no decorative stars;
- no requests to other origins;
- no claim that the app predicts events.

## 11. Before a UI commit

1. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and
   `npm run e2e`.
2. Look at the screenshots in `e2e-artifacts/screens` (1440 px, iPhone SE,
   320 px and Pixel 7).
3. Compare the result with this file and with both ban lists.
