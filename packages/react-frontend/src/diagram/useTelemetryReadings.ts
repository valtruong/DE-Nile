import {
  useTopicReadings,
  type Binding,
  type TelemetrySource
} from "@de-nile/pid-viewer";

export interface DiagramTelemetry {
  bindings: Record<string, Binding>;
  source?: TelemetrySource;
}

/** Keep telemetry subscriptions separate from the editor's saved diagram state. */
export function useTelemetryReadings(
  telemetry?: DiagramTelemetry
) {
  return useTopicReadings(
    telemetry?.source,
    Object.values(telemetry?.bindings ?? {}).map(
      (binding) => binding.topic
    )
  );
}
