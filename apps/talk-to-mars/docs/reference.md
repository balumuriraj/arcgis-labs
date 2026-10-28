# Reference

## Data

| Data                           | Source                                                                                  | Where it lives                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Mars imagery                   | Esri `OnMars/MDIM` (Viking and MOC color mosaic, NASA/JPL/USGS)                         | Public tile service                                                   |
| Close-up imagery               | Esri `OnMars/CTX1` (MRO Context Camera mosaic, NASA/JPL/MSSS/Caltech Murray Lab)        | Public tile service, shown below 1:3,000,000                          |
| Elevation                      | Esri `OnMars/MDEM200M` (HRSC and MOLA blend, USGS/NASA/ESA)                             | Public image service                                                  |
| Elevation colors               | Esri `OnMars/MColorDEM` (shaded relief of the same elevation model)                     | Public tile service, off until the guide turns it on                  |
| Named features                 | Esri `Mars_Nomenclature_All` (IAU/USGS Gazetteer of Planetary Nomenclature, March 2019) | Public feature service, read once at startup                          |
| Rover routes                   | NASA/JPL-Caltech MMGIS traverse maps for Perseverance (M20) and Curiosity (MSL)         | `public/data/traverses.json`, rebuilt by `node scripts/traverses.mjs` |
| Landing attempts, launch sites | Compiled for this app                                                                   | `src/records.ts`                                                      |

All the Mars services are in GCS_Mars_2000_Sphere (wkid 104971, radius 3,396,190 m).

NASA imagery and data are generally not copyrighted; credit NASA/JPL-Caltech. The IAU names
are public. Esri's services carry their own attribution, shown on the map.

## Before a public demo: check the mission records

`src/records.ts` was compiled from general knowledge, not copied from one authoritative
source. Check each record against NASA's NSSDCA catalogue
(<https://nssdc.gsfc.nasa.gov/nmc/>) before relying on it, especially:

- **Approximate sites.** Mars 2, Mars 3, Mars 6, Mars Polar Lander, and Deep Space 2 were
  never confirmed from orbit; their coordinates are rounded published estimates
  (`approximate: true`, said on the card). Deep Space 2's position is placed near Mars
  Polar Lander's target and isn't independently sourced.
- **Dates.** Launch and arrival dates are UTC calendar dates. Opportunity launched on
  July 7, 2003 local time (July 8 UTC); Zhurong landed on May 15, 2021 Beijing time
  (May 14 UTC).
- **Notes.** Each `note` is what the guide uses to explain a failure, so wording there
  becomes the guide's claim.

## Scope

- The missions layer holds spacecraft that **reached the surface**, working or not: 17,
  of which 10 landed and worked. Orbiters, flybys, Mars 7 (missed the planet) and Mars 96
  (never left Earth orbit) aren't included.
- Feature sizes are the gazetteer's: a crater's diameter, or roughly the longest extent
  of anything else. Heights and depths aren't in the data.
- Routes exist only for Perseverance and Curiosity. Sojourner, Spirit, Opportunity, and
  Zhurong show their landing sites only.

## Known issues

- One elevation tile (level 7, row 60, column 70) fails to decode in the SDK with
  `RangeError: Invalid typed array length`, although the service returns it normally.
  The terrain falls back to coarser data there. Worth reporting to the SDK team.
- The CTX mosaic is grayscale, so close-ups lose the planet's color. MDIM shows through
  wherever CTX has gaps.
