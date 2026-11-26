"use client";

import FanGate from "@/components/FanGate";
import ChartsView from "@/components/ChartsView";

/** Behind the sign-in wall like the rest of the app. */
export default function ChartsClient() {
  return <FanGate>{() => <ChartsView />}</FanGate>;
}
