"use client";

import dynamic from "next/dynamic";

const AftershockApp = dynamic(() => import("./components/aftershock-app"), {
  ssr: false,
  loading: () => <p role="status">Loading Aftershock Replay...</p>,
});

export default function Page() {
  return <AftershockApp />;
}
