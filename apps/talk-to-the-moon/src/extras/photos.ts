/**
 * Landing and impact sites seen from lunar orbit: one crop per mission from the LROC (Lunar
 * Reconnaissance Orbiter Camera) Featured Sites catalogue, https://lroc.im-ldi.com/featured_sites.
 * For each site the sharpest crop with the Sun 30 to 75 degrees from overhead was picked, so
 * shadows show the hardware. Files are in public/photos/<mission id>.jpg (the crops as LROC publishes
 * them, most 1000 x 562). Credit: NASA/GSFC/Arizona State University.
 */
/**
 * Whether to show the photos. LROC's website images are copyrighted: educational use with the credit
 * is allowed, commercial use needs their permission (https://lroc.im-ldi.com/about/terms). Turn them
 * off with ?photos=off in the URL or NEXT_PUBLIC_PHOTOS=off in .env.local, e.g. for a public demo.
 */
export const photosEnabled =
  process.env.NEXT_PUBLIC_PHOTOS !== "off" && (typeof location === "undefined" || new URLSearchParams(location.search).get("photos") !== "off");

/** The photo for a mission, if there is one and photos are on. */
export const photoFor = (missionId: string): SitePhoto | undefined => (photosEnabled ? PHOTOS[missionId] : undefined);

export interface SitePhoto {
  imageId: string;
  /** When LRO took it (UTC, ISO 8601). */
  date: string;
  altitudeKm: number;
  metersPerPixel: number;
  /** Sun's angle from overhead at the site, in degrees: low numbers mean short shadows. */
  incidenceDeg: number;
  /** The image's page on the LROC site. */
  page: string;
  /** Pixel size of public/photos/<mission id>.jpg. */
  width: number;
  height: number;
}

export const PHOTOS: Record<string, SitePhoto> = {
  "apollo-11": { imageId: "M175124932R", date: "2011-11-05T09:34:24Z", altitudeKm: 24, metersPerPixel: 0.4, incidenceDeg: 41, page: "https://lroc.im-ldi.com/featured_sites/apollo-11/site_images/m175124932r", width: 1000, height: 562 },
  "apollo-12": { imageId: "M175428601R", date: "2011-11-08T21:55:34Z", altitudeKm: 23, metersPerPixel: 0.4, incidenceDeg: 45, page: "https://lroc.im-ldi.com/featured_sites/apollo-12/site_images/m175428601r", width: 1000, height: 562 },
  "apollo-14": { imageId: "M175388134R", date: "2011-11-08T10:41:07Z", altitudeKm: 26, metersPerPixel: 0.42, incidenceDeg: 45, page: "https://lroc.im-ldi.com/featured_sites/apollo-14/site_images/m175388134r", width: 1000, height: 562 },
  "apollo-15": { imageId: "M175252641LR", date: "2011-11-06T21:02:53Z", altitudeKm: 25, metersPerPixel: 0.41, incidenceDeg: 49, page: "https://lroc.im-ldi.com/featured_sites/apollo-15/site_images/m175252641lr", width: 1000, height: 562 },
  "apollo-16": { imageId: "M175179080LR", date: "2011-11-06T00:36:52Z", altitudeKm: 24, metersPerPixel: 0.41, incidenceDeg: 42, page: "https://lroc.im-ldi.com/featured_sites/apollo-16/site_images/m175179080lr", width: 1000, height: 562 },
  "apollo-17": { imageId: "M168000580R", date: "2011-08-14T22:35:12Z", altitudeKm: 22, metersPerPixel: 0.42, incidenceDeg: 45, page: "https://lroc.im-ldi.com/featured_sites/apollo-17/site_images/m168000580r", width: 1000, height: 562 },
  "surveyor-1": { imageId: "M1121521701R", date: "2013-04-25T09:33:54Z", altitudeKm: 95, metersPerPixel: 0.95, incidenceDeg: 45, page: "https://lroc.im-ldi.com/featured_sites/surveyor-1/site_images/m1121521701r", width: 1000, height: 562 },
  "surveyor-3": { imageId: "M175428601R", date: "2011-11-08T21:55:34Z", altitudeKm: 23, metersPerPixel: 0.25, incidenceDeg: 45, page: "https://lroc.im-ldi.com/featured_sites/surveyor-3/site_images/m175428601r", width: 1000, height: 562 },
  "surveyor-5": { imageId: "M1098701979L", date: "2012-08-04T06:45:12Z", altitudeKm: 107, metersPerPixel: 1.1, incidenceDeg: 45, page: "https://lroc.im-ldi.com/featured_sites/surveyor-5/site_images/m1098701979l", width: 1000, height: 562 },
  "surveyor-6": { imageId: "M152885739L", date: "2011-02-21T00:01:12Z", altitudeKm: 39, metersPerPixel: 0.4, incidenceDeg: 33, page: "https://lroc.im-ldi.com/featured_sites/surveyor-6/site_images/m152885739l", width: 1000, height: 562 },
  "surveyor-7": { imageId: "M175355093L", date: "2011-11-08T01:30:25Z", altitudeKm: 30, metersPerPixel: 0.3, incidenceDeg: 56, page: "https://lroc.im-ldi.com/featured_sites/surveyor-7/site_images/m175355093l", width: 1000, height: 562 },
  "ranger-7": { imageId: "M153014430L", date: "2011-02-22T11:46:02Z", altitudeKm: 43, metersPerPixel: 0.45, incidenceDeg: 34, page: "https://lroc.im-ldi.com/featured_sites/ranger-7/site_images/m153014430l", width: 1000, height: 562 },
  "luna-16": { imageId: "M159582808L", date: "2011-05-09T12:19:01Z", altitudeKm: 40, metersPerPixel: 0.4, incidenceDeg: 44, page: "https://lroc.im-ldi.com/featured_sites/luna-16/site_images/m159582808l", width: 1000, height: 562 },
  "luna-17": { imageId: "M175502049R", date: "2011-11-09T18:19:42Z", altitudeKm: 31, metersPerPixel: 0.35, incidenceDeg: 58, page: "https://lroc.im-ldi.com/featured_sites/luna-17/site_images/m175502049r", width: 1000, height: 562 },
  "luna-20": { imageId: "M174902210R", date: "2011-11-02T19:42:22Z", altitudeKm: 27, metersPerPixel: 0.3, incidenceDeg: 39, page: "https://lroc.im-ldi.com/featured_sites/luna-20/site_images/m174902210r", width: 1000, height: 562 },
  "luna-21": { imageId: "M122007650L", date: "2010-02-28T14:46:23Z", altitudeKm: 44, metersPerPixel: 0.5, incidenceDeg: 37, page: "https://lroc.im-ldi.com/featured_sites/luna-21/site_images/m122007650l", width: 1000, height: 562 },
  "luna-23": { imageId: "M174868307R", date: "2011-11-02T10:17:19Z", altitudeKm: 26, metersPerPixel: 0.3, incidenceDeg: 40, page: "https://lroc.im-ldi.com/featured_sites/luna-23/site_images/m174868307r", width: 1000, height: 562 },
  "luna-24": { imageId: "M174868307L", date: "2011-11-02T10:17:19Z", altitudeKm: 26, metersPerPixel: 0.3, incidenceDeg: 40, page: "https://lroc.im-ldi.com/featured_sites/luna-24/site_images/m174868307l", width: 1000, height: 562 },
  "change-3": { imageId: "M1152001999R", date: "2014-04-13T04:18:52Z", altitudeKm: 147, metersPerPixel: 1.36, incidenceDeg: 57, page: "https://lroc.im-ldi.com/featured_sites/chang-e-3-landing-site/site_images/m1152001999r", width: 1000, height: 562 },
  "change-4": { imageId: "M1355307302R", date: "2020-09-21T06:00:34.914Z", altitudeKm: 82, metersPerPixel: 0.86, incidenceDeg: 62, page: "https://lroc.im-ldi.com/featured_sites/chang-e-4-landing-site/site_images/m1355307302r", width: 1000, height: 562 },
  "blue-ghost-1": { imageId: "M1523708434", date: "2026-01-22T08:06:07Z", altitudeKm: 80, metersPerPixel: 0.84, incidenceDeg: 73, page: "https://lroc.im-ldi.com/featured_sites/blue-ghost-1/site_images/m1523708434", width: 1300, height: 800 },
  "im-2": { imageId: "M1496237988", date: "2025-03-10T09:25:21Z", altitudeKm: 86, metersPerPixel: 0.44, incidenceDeg: 85, page: "https://lroc.im-ldi.com/featured_sites/im2/site_images/m1496237988", width: 1300, height: 1300 },
};
