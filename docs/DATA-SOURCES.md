# Data sources

Sources that the code, the tests or the documentation use. Files that ship
with the site are listed with their licenses in [CREDITS.md](../CREDITS.md).

| Source | Used for | License or status |
|---|---|---|
| [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 | All positions, eclipses and sidereal time | MIT |
| [NASA JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Reference positions in `tests/fixtures/horizons-reference.json`, fetched once by `scripts/fetch-horizons-reference.ts` | US government work. Credit: NASA/JPL-Caltech, Horizons System |
| VedicAstrologer (same author) | Ported engine helpers and their tests | MIT |
| Surya Siddhanta, translated by E. Burgess (1860) | Combustion orbs (9.6 to 9.8, 10.1) | Public domain |
| Brihat Samhita, translated by N. Chidambaram Iyer (1884) | Koorma Chakra table (chapter 14) and the eclipse-region rule (5.42), from milestone M5 | Public domain |
| Hipparcos catalogue position of Spica | One test of the ayanamsa | A fact (a star position) |

Rules for new sources:

- Facts and dates have no copyright. Store them with a source link.
- Write every description in own words. Do not copy Wikipedia text (CC BY-SA).
- Do not copy modern translations of classical texts. Use public-domain
  translations or own words.
