"use client";

import FanGate from "@/components/FanGate";
import Trophies from "@/components/Trophies";

export default function BadgesPage() {
  return <FanGate>{(fan) => <Trophies fan={fan} />}</FanGate>;
}
