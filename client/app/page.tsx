"use client";

import DiscoveryQueue from "@/components/DiscoveryQueue";
import FanGate from "@/components/FanGate";

export default function Home() {
  return <FanGate>{(fan) => <DiscoveryQueue fan={fan} />}</FanGate>;
}
