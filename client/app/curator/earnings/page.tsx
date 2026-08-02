"use client";

import CuratorEarnings from "@/components/CuratorEarnings";
import CuratorGate from "@/components/CuratorGate";

export default function CuratorEarningsPage() {
  return <CuratorGate>{(curator) => <CuratorEarnings curator={curator} />}</CuratorGate>;
}
