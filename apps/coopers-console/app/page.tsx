"use client";

import dynamic from "next/dynamic";

const CoopersConsoleApp = dynamic(
  () =>
    import("./components/coopers-console-app").then(
      (module) => module.CoopersConsoleApp,
    ),
  {
    ssr: false,
  },
);

export default function Page() {
  return <CoopersConsoleApp />;
}