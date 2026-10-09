# Method

This page states every convention that Medini Atlas uses, and how each one
was checked. It grows with the app: a section appears when its feature ships.

Medini Atlas shows calculated sky positions and traditional Jyotish rules. It
does not predict events, and nothing here claims that astrology predicts
events.

## Positions

- **Engine.** Apparent geocentric positions from
  [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 (MIT),
  on the true ecliptic and equinox of date (`GeoVector` with aberration, then
  `Ecliptic`).
- **Check against NASA JPL Horizons.** 70 positions (Sun, Moon, Mercury,
  Venus, Mars, Jupiter and Saturn at 10 instants from 1900 to 2050) agree
  within 13 arcseconds in longitude. The test tolerance is 30 arcseconds
  (`tests/horizons.test.ts`).
- **Moon.** Positions are geocentric. A panchang made for one place
  (topocentric) can place the Moon up to about 1 degree differently.
- **Speed and retrograde.** Speed is a centred difference over ±0.5 day. A
  graha is retrograde while its longitude decreases. The Sun and the Moon are
  always direct.

## Sidereal zodiac (Lahiri)

- Mean Lahiri (Chitrapaksha) ayanamsa of 23°51′25.5324″ at J2000.0, plus the
  IAU 1976 general precession in longitude (Lieske et al. 1977).
- Planets take the true ayanamsa: the mean value plus a 4-term IAU 1980
  nutation in longitude (about 0.5 arcsecond).
- Values: about 22.46° on 1900-01-01, 23.86° on 2000-01-01 and 24.56° on
  2050-01-01.
- **Check.** With this ayanamsa, Spica (Chitra) stays at sidereal 179.98°
  from 1900 to 2050 (`src/engine/ayanamsa.test.ts`).
- Signs are 30° wide, nakshatras 13°20′ and padas 3°20′. A body within about
  1° of a sign boundary can fall in the next sign under another ayanamsa.

## Rahu and Ketu

- The **mean node** is the default (IERS Conventions 2003). It takes the mean
  ayanamsa, because it is referred to the mean equinox. Ketu is Rahu plus 180°.
- The engine also has the **true (osculating) node**. From 1900 to 2050 it
  stays within 1.96° of the mean node. The app does not offer it yet.

## Traditional rules

- **Graha drishti** is sign-based and counted inclusively from the graha's
  own sign. Every graha aspects the 7th sign. Mars also aspects the 4th and
  8th, Jupiter the 5th and 9th, Saturn the 3rd and 10th. Rahu and Ketu cast
  no aspects in this app, because the traditions disagree.
- **Conjunction (yuti):** within 10° in longitude. The app also reports
  whether both grahas are in the same sign. Rahu and Ketu are never a pair.
- **Graha yuddha (planetary war):** 2 of Mars, Mercury, Jupiter, Venus and
  Saturn within 1°.
- **Combustion (asta):** distance from the Sun of 12° for the Moon, 17° for
  Mars, 11° for Jupiter and 15° for Saturn. Venus takes 8° near its inferior
  conjunction (retrograde) and 10° otherwise. Mercury takes 12° when
  retrograde and 14° otherwise. Source: Surya Siddhanta 9.6 to 9.8 and 10.1,
  in the public-domain translation of E. Burgess (1860). The text gives
  "degrees of time" (oblique ascension) for visibility. Like most Jyotish
  software, the app applies them as distances in longitude.
- **Kala Sarpa:** all 7 physical grahas, the Moon included, on one side of
  the mean Rahu-Ketu axis. The app names the side (following Rahu or
  following Ketu in zodiac order). The Moon crosses the axis twice a month,
  so a window lasts at most about 15 days. From 1900 to 2050 there are 333
  windows, which cover 7.2 % of all days. The longest lasts 14.8 days.

## Event searches

- Every event instant is refined by bisection to 1 minute.
- **Ingresses** cover sign changes of the Sun, Mercury, Venus, Mars, Jupiter,
  Saturn and Rahu, and nakshatra changes of Jupiter, Saturn and Rahu,
  including retrograde returns.
- **Stations** are the instants where the longitude speed changes sign. The
  refinement uses a ±1 hour speed. Mercury's stations of April 2024 fall
  within 2 minutes of published almanac times.
- **Conjunctions** are equal sidereal longitudes, so they happen at the same
  instant as tropical conjunctions.
- **Great conjunctions** (Jupiter and Saturn) are in geocentric ecliptic
  longitude. Lists in right ascension, or of mean heliocentric conjunctions,
  can differ by days. The list runs from 1000 to 2100. Entries before 1700 are
  labelled approximate, because astronomy-engine documents its 1-arcminute
  accuracy for the modern era.
- **Eclipses** come from astronomy-engine. For a central (total or annular)
  solar eclipse the app shows the peak point of the central line. A partial
  solar eclipse has no central line, so the app shows the sub-solar point at
  peak, labelled "no central line". For a lunar eclipse it shows the
  sub-lunar point, the centre of the hemisphere that sees the Moon.

## Sub-planet points

The place on Earth where a graha stands at the zenith: latitude equals its
apparent declination of date, and longitude equals its right ascension minus
Greenwich apparent sidereal time.

## Calendar

- Instants are stored in UTC.
- Dates before 15 October 1582 are shown in the Julian calendar, as history
  books give them. For example, the great conjunction of 1345-04-01 12:15 UT
  (proleptic Gregorian) shows as 24 March 1345 (Julian).

## Precomputed data

`scripts/generate-sky-data.ts` writes the files in `public/data`:

- a daily table of sidereal longitudes at 00:00 UTC from 1900 to 2050 for the
  Sun, Mercury, Venus, Mars, Jupiter, Saturn and mean Rahu, in steps of
  360/65536 degrees (about 20 arcseconds);
- the sky events from 1900 to 2050: ingresses, stations, conjunctions,
  eclipses and Kala Sarpa windows;
- the great conjunctions from 1000 to 2100.

CI generates the files again and compares them with the committed ones. The
comparison allows 1 table step, 2 minutes and 0.002°, because results can
differ slightly between JavaScript engine versions.
