"use client";

import FanGate from "@/components/FanGate";
import SavedList from "@/components/SavedList";

export default function SavedPage() {
  return <FanGate>{(fan) => <SavedList fan={fan} />}</FanGate>;
}
