import { useMemo } from "react";
import { PIDViewer, type PIDViewerProps } from "./PIDViewer";
import {
  createRiverDashSource,
  type RiverDashOptions,
  type RiverDashTable
} from "./telemetry";

/** Reuse the host table and transport; never open a second WebSocket. */
export function useRiverDashSource(
  table: RiverDashTable<"R">,
  { staleAfterMs = 5000, decode }: RiverDashOptions = {}
) {
  return useMemo(
    () =>
      createRiverDashSource(table, "R", {
        staleAfterMs,
        decode
      }),
    [table, staleAfterMs, decode]
  );
}

export interface RiverDashViewerProps extends Omit<
  PIDViewerProps,
  "dataSource"
> {
  table: RiverDashTable<"R">;
  staleAfterMs?: number;
  decode?: RiverDashOptions["decode"];
}

/** Host-mounted viewer with stable, exclusively read-only GDT subscriptions. */
export function RiverDashViewer({
  table,
  staleAfterMs,
  decode,
  ...viewerProps
}: RiverDashViewerProps) {
  const source = useRiverDashSource(table, {
    staleAfterMs,
    decode
  });
  return <PIDViewer {...viewerProps} dataSource={source} />;
}
