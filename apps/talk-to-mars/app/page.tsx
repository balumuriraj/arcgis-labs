"use client";

import dynamic from "next/dynamic";

// The ArcGIS SDK needs the browser, so the app renders on the client only.
const App = dynamic(() => import("../src/App"), { ssr: false });

export default function Page() {
  return <App />;
}
