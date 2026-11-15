"use client";

import FanGate from "@/components/FanGate";
import BattleView from "@/components/BattleView";

export default function BattlesPage() {
  return <FanGate>{() => <BattleView />}</FanGate>;
}
