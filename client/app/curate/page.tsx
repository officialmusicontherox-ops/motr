"use client";

import AssignmentQueue from "@/components/AssignmentQueue";
import CuratorGate from "@/components/CuratorGate";

export default function CuratePage() {
  return <CuratorGate>{(curator) => <AssignmentQueue curator={curator} />}</CuratorGate>;
}
