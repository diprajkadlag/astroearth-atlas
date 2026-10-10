# Data sources

Sources that the code, the tests or the documentation use. Files that ship
with the site are listed with their licenses in [CREDITS.md](../CREDITS.md).

| Source | Used for | License or status |
|---|---|---|
| [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 | All positions, eclipses and sidereal time | MIT |
| [NASA JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Reference positions in `tests/fixtures/horizons-reference.json`, fetched once by `scripts/fetch-horizons-reference.ts` | US government work. Credit: NASA/JPL-Caltech, Horizons System |
| VedicAstrologer (same author) | Ported engine helpers and their tests | MIT |
| Surya Siddhanta, translated by E. Burgess (1860) | Combustion orbs (9.6 to 9.8, 10.1) | Public domain |
| Brihat Samhita, translated by N. Chidambaram Iyer (1884): [scan at the Wellcome Collection](https://wellcomecollection.org/works/sv4b6vbn); text of [chapter 14](https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc228914.html) and [chapter 5](https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc226721.html), read on 2026-10-10 | Koorma Chakra divisions, nakshatras and lands (chapter 14), and the eclipse-region rule (5.42), in `src/engine/koorma.ts` and METHOD.md | Public domain. The app stores only the division table and names of lands |
| Wikidata, USGS, official pages (WHO, CERN, the South African government, the Embassy of India in Washington, the IMD journal MAUSAM, the National Assembly of Pakistan) | Dates, places and items of the world events in `src/data/worldEvents.ts` | Facts. Wikidata is CC0. Summaries are in own words |
| Hipparcos catalogue position of Spica | One test of the ayanamsa | A fact (a star position) |
| NASA Earth Observatory, [Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry), July 2004, topography and bathymetry, 5400 x 2700 JPEG | The day side of the Earth (`public/textures/earth-day-*.webp`) | [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/): not subject to US copyright. Credit NASA. No logo, no endorsement |
| NASA Earth Observatory, [Black Marble 2016](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/), grayscale, 3 km, 13500 x 6750 JPEG | City lights on the night side (`public/textures/earth-night-*.webp`) | As above |

### Earth textures

`scripts/make-earth-textures.ts` makes the textures from the 2 originals. The
originals are not in the repository (8 MB together). Download them, then run
`npm run textures -- <folder>`. The script refuses files with another
SHA-256:

| File | SHA-256 |
|---|---|
| [world.topo.bathy.200407.3x5400x2700.jpg](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg) | `4f4240673a3a1b173d61b92ca4b07bac5fd17059ea5f725ba6da5a9c5386b7ba` |
| [BlackMarble_2016_3km_gray.jpg](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_3km_gray.jpg) | `3fbc8aae3529dc1ebfcf3aa9361bd3dfc11d19950a6af6d8ed2df61bd8b0134d` |

Both maps show no political borders. The app must not add any (CLAUDE.md).

Rules for new sources:

- Facts and dates have no copyright. Store them with a source link.
- Write every description in own words. Do not copy Wikipedia text (CC BY-SA).
- Do not copy modern translations of classical texts. Use public-domain
  translations or own words.
