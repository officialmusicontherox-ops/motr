"use client";

import FanGate from "@/components/FanGate";
import SpotlightView from "@/components/SpotlightView";

/** Behind the sign-in wall like the rest of the app. */
export default function SpotlightClient() {
  return <FanGate>{() => <SpotlightView />}</FanGate>;
}
