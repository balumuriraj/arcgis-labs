import esriConfig from "@arcgis/core/config.js";

// Runs before any component loads (see register.ts): the assistant reads the default portal when it loads.
esriConfig.applicationName = "Talk to Mars";
esriConfig.portalUrl =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://devext.arcgis.com";
if (process.env.NEXT_PUBLIC_ARCGIS_API_KEY)
  esriConfig.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
