# AstroEarth Atlas: project rules

The approved plan is in
`C:\Users\dipra\.claude\plans\so-we-will-develop-graceful-sedgewick.md`
(approved 2026-10-09). Follow its milestones (M0 to M6, then version 1.1).

## Product rules
1. Show calculated sky positions and traditional rules. Never claim that the app predicts events.
2. Make zero requests to other origins at runtime. Self-host every font, texture and data file. Keep the Content-Security-Policy plugin in `vite.config.ts`.
3. Add a row to `CREDITS.md` for every file in `public/textures`, `public/fonts` and `public/data`, in the same commit.
4. Ship only permissive licenses (MIT, ISC, Apache-2.0, BSD). Run `npm run licenses`. Do not add Swiss Ephemeris or GSAP.
5. Do not draw political borders on the globe.
6. Name Abhigya Anand only in the README credit line. Never in the app, page metadata, keywords or GitHub topics. Make no claim about any person's forecasts.
7. Write event summaries in own words. Store facts and Wikidata IDs. Do not copy Wikipedia text.
8. Market history (version 1.1): dated facts only. No prices, tickers, future market dates or direction words.
9. Brihat Samhita: use the Iyer translation (1884, public domain) or own words. Cite chapter and stanza.

## Engineering rules
- Node 24 (`.nvmrc`). Dev port 4747. Preview and e2e port 4748.
- Relative imports carry explicit `.ts` or `.tsx` extensions, so Node 24 runs scripts in `scripts/` without a build step.
- `erasableSyntaxOnly` is on: no enums, namespaces or parameter properties.
- Before each commit: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. After UI changes: `npm run e2e`.
- After any change in `src/engine/`: run `npm run data`, commit the changed files in `public/data`, and update `docs/METHOD.md` when a convention changes.
- Engine searches take a `sampler` option. Long scans pass `cachingSampler()` so that 00:00 UTC positions are computed once.
- Scene tests read positions from a debug hook on `window`, never from pixels. Screenshots are for review only.
- The scene frame is Z-up, right-handed, sidereal ecliptic of date. Longitude increases counter-clockwise seen from ecliptic north.
- Document pages (About, Method, Privacy, Impressum, Credits) are `pages/*.html`, rendered at build time by `scripts/doc-pages.ts` from `src/content/en/*.md`, `docs/METHOD.md` and the table of `CREDITS.md`. The Pages workflow runs `npm run release-check`, which refuses to publish while a `[TODO` marker remains.
- Design rules live in `DESIGN.md` (Yantra direction, chosen 2026-10-09). Read it before any interface change. Colours come from `src/design/tokens.css` and `src/design/palette.ts` only.

## Writing rules
- Interface text: plain English, short sentences, sentence case. Every string goes into `src/i18n/en.ts`.
- Reports to the user follow the ASD-STE100 rules in the user's global CLAUDE.md.
