"use client";

import dynamic from "next/dynamic";

const OopsMapApp = dynamic(
  () => import("./components/oops-map-app").then((module) => module.OopsMapApp),
  {
    ssr: false,
  },
);

export default function Page() {
  return <OopsMapApp />;
}
