"use client";

import dynamic from "next/dynamic";

const WorldCupCompanionApp = dynamic(
  () =>
    import("./components/world-cup-companion-app").then(
      (module) => module.WorldCupCompanionApp,
    ),
  {
    ssr: false,
  },
);

export default function Page() {
  return <WorldCupCompanionApp />;
}
