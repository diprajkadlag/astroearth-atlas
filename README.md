# Medini Atlas

An interactive 3D Earth and planetary time waves for Vedic mundane astrology
(Medini Jyotisha). It shows the sidereal sky (Lahiri) from 1900 to 2050 beside
dated world events, and maps the Koorma Chakra of the Brihat Samhita onto the
globe.

> **Status:** in development. The repository is private until the first
> release is ready.

## What it is, and what it is not

Medini Atlas shows calculated sky positions and traditional Jyotish rules. It
does not predict events. It is not financial, medical, legal or safety advice.

The site makes no request to any other server: fonts, textures and data ship
with it, and there are no cookies, accounts or analytics.

## Development

Requirements: Node.js 24 (see `.nvmrc`) and npm 11.

```bash
npm install
npm run dev        # http://localhost:4747
```

Checks (the same ones that CI runs):

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run licenses   # production licenses and THIRD_PARTY_NOTICES.md
npm run e2e        # browser checks against the built site (port 4748)
```

The first `npm run e2e` needs a browser: `npx playwright install chromium`.

## Credits

- Inspired in part by public talks on mundane astrology, including talks by
  Abhigya Anand. Medini Atlas is an independent hobby project. It is not
  affiliated with, sponsored, endorsed or reviewed by Abhigya Anand. All data,
  calculations and interpretations are the author's own.
- Textures, fonts and data: see [CREDITS.md](CREDITS.md).
- Open-source libraries: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

The source code is available under the [MIT License](LICENSE). Assets and data
keep their own licenses, listed in [CREDITS.md](CREDITS.md).
