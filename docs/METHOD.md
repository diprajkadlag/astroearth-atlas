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

## The 3D scene

- **Frame.** The scene is right-handed with Z up, in the sidereal ecliptic of
  date. +X points to sidereal 0° (the start of Ashwini) and +Z to the north
  ecliptic pole. Seen from the north, longitude increases counter-clockwise.
  The ring is not to scale: the Earth has radius 1 and the ring radius 1.8.
- **Earth rotation.** A vector of the Earth body frame goes into the scene as
  `Rz(−ayanamsa) · R(EQD→ECT) · Rz(GAST) · v`. GAST is Greenwich apparent
  sidereal time. R(EQD→ECT) turns the true equator of date into the true
  ecliptic of date (astronomy-engine). The true ayanamsa is used, as for the
  planets. Polar motion is ignored.
- **Checks.** At 5 instants from 1900 to 2050, the place on Earth under each
  scene direction matches the engine's sub-planet point within 0.1°. The
  Earth's north pole leans toward tropical longitude 90° by the obliquity
  (`src/scene/frame.test.ts`). The browser tests read the Earth's own matrix
  and the Sun marker from the running page and check the sub-solar point in
  the same way (`e2e/scene.spec.ts`).
- **Earth motion.** For a date step under 1 day (a timeline span under 60
  days), the Earth shows the true time of day. For a step of 1 day or more,
  and during playback, it shows 00:00 UTC of the date, so the globe stays
  calm. The ring and the grahas always show the true instant.
- **Graha marks.** The marks sit on the ring at their sidereal longitude. The
  ecliptic latitude is not shown. The Moon mark shows the phase as seen from
  the Earth: its lit part follows the elongation from the Sun (new at 0°, full
  at 180°), and its lit limb faces the Sun's mark on screen.

## Tithi

The tithi is the lunar day at the shown instant: the Moon's elongation from
the Sun, in steps of 12°. Tithis 1 to 15 are Shukla (waxing), 16 to 30
Krishna (waning). Tithi 15 is Purnima and tithi 30 Amavasya. A panchang gives
the tithi at local sunrise, so it can differ from the tithi at 00:00 UTC.

## Cycles view

For a pair of grahas, the Cycles view draws the cosine of the angle between
their sidereal longitudes. The value is +1 at a conjunction, 0 at a square and
-1 at an opposition. The cosine has no wrap at 360°, so each pair is one
unbroken line. The same angle holds in the tropical zodiac.

## World events

- **Selection.** Major events with a clear start date, global events and key
  events of India. No event is added or removed because of the sky at its
  date. Every title and summary is written in own words. The app stores facts
  and the Wikidata item of each event (CC0), never Wikipedia text.
- **Start date.** An event needs a start date known at least to the month.
  So the Bengal famine of 1943 is not listed: Wikidata (Q522837) gives the
  year only.
- **Wars, attacks and disputes.** Titles and summaries say what happened and
  when, in neutral words, and give no blame where the facts are disputed. A
  war fought over a wide area has no place, so the globe shows no pin for it.
- **Time rule.** An event with a stated time uses that UTC time. An event
  known to the day uses 12:00 local mean time at its place (4 minutes per
  degree of longitude east of Greenwich), or 12:00 UTC without a place. An
  event known to the month uses 12:00 UTC on the 1st. When the local date of
  an event differs from its UTC date, the list stores the day, so the card
  shows the local date. For example, the Latur earthquake struck at 22:25 UTC
  on 29 September 1993, which was 30 September in India.
- **Moon range.** A day-precision event card shows where the Moon stood at
  the start and the end of that local day, because the Moon moves about 13°
  in a day.
- **Eclipses and conjunctions** on the timeline come from the precomputed sky
  events (see above). Their cards give calculated facts only. astronomy-engine
  names each solar eclipse by its type at greatest eclipse, so a hybrid
  eclipse, such as the one of 2023-04-20, shows as total.
- **Sources.** Each date, place and Wikidata item was checked on 2026-10-10.
  Where Wikidata gives no day, the card links the official page that does
  (WHO, CERN, the South African government, the Embassy of India in
  Washington for Pokhran-II, and the IMD journal MAUSAM for the Odisha
  cyclone of 1999).

## Sky moments

The shortcuts under "Sky moments" are calculated facts, checked by
`tests/presets.test.ts`:

- 5 February 1962, 00:00 UTC: 8 grahas in Capricorn (all 7 planets and Ketu).
- 26 December 2019, 00:00 UTC: 6 grahas in Sagittarius (Sun, Moon, Mercury,
  Jupiter, Saturn and Ketu).
- 21 December 2020, 18:26 UTC: the conjunction of Jupiter and Saturn in
  Capricorn.

## Comparison with Drik Panchang

On 2026-10-09, a check compared the engine with the sidereal planetary
positions of [Drik Panchang](https://www.drikpanchang.com/planet/position/planetary-positions-sidereal.html)
(Lahiri, mean nodes, New Delhi, 12:00 IST) on 3 dates: 1925-06-01, 1962-02-05
and 2020-12-21.

- All 27 differences (9 grahas on 3 dates) are below 1 arcminute. The largest
  is 0.71′ (the Moon on 1925-06-01).
- The engine is ahead by 0.4′ to 0.7′ on almost every row, for 2 probable
  reasons:
  - Drik Panchang's ayanamsa is 24.14″ larger than the engine's mean
    ayanamsa on all 3 dates. Both probably use the same precession, with a
    different value at the anchor epoch. This gives the 0.40′ on Rahu and
    Ketu.
  - Drik Panchang probably subtracts an ayanamsa without nutation from
    true-equinox longitudes. The engine subtracts the true ayanamsa (with
    nutation), as stated above. This adds 0.17′ to 0.28′ on the 7 planets.
- Both use a geocentric Moon.
- Consequence: a graha within about 0.7′ of a nakshatra, pada or sign
  boundary can fall on the other side of it in Drik Panchang.

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
