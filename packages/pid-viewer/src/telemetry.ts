import type { Binding, Scalar } from "./diagram";

export type Reading =
  | { status: "available"; value: Scalar; updatedAt?: string }
  | { status: "unavailable"; message: string }
  | { status: "invalid"; message: string };

/** The viewer consumes this read-only boundary, never a hardware command API. */
export interface TelemetrySource {
  subscribe(
    topic: string,
    listener: (reading: Reading) => void
  ): () => void;
}

export interface ReadTopic extends EventTarget {
  read_data(): unknown;
  get_last_update_time(): { toString(): string };
}
interface ReadResult {
  match(
    ok: (topic: ReadTopic) => void,
    error: (error: unknown) => void
  ): unknown;
}
/** Structural typing keeps the unpublished RiverDash package out of our bundle. */
export interface RiverDashTable<
  ReadMode extends string
> extends EventTarget {
  get_topic(name: string, mode: ReadMode): ReadResult;
}
export interface RiverDashOptions {
  decode?: (value: unknown) => Scalar;
}

/** Decode numeric RiverDash wrappers; compound types require a host decoder. */
export function decodeRiverDashValue(value: unknown): Scalar {
  let raw = value;
  if (
    raw !== null &&
    typeof raw === "object" &&
    "get" in raw &&
    typeof raw.get === "function"
  ) {
    raw = raw.get();
  }
  if (typeof raw === "bigint") {
    if (
      raw > BigInt(Number.MAX_SAFE_INTEGER) ||
      raw < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error(
        "64-bit value exceeds safe numeric display range"
      );
    }
    raw = Number(raw);
  }
  if (
    typeof raw === "string" ||
    typeof raw === "boolean" ||
    (typeof raw === "number" && Number.isFinite(raw))
  )
    return raw;
  throw new Error(
    "Unsupported telemetry value; supply a decoder for compound RiverDash types"
  );
}

/**
 * Pass the host's GDT and TopicOpenMode.Read. No table or network is created here.
 * Event names match RiverDash global_data_table branch commit 93e27bf.
 */
export function createRiverDashSource<ReadMode extends string>(
  table: RiverDashTable<ReadMode>,
  readMode: ReadMode,
  options: RiverDashOptions = {}
): TelemetrySource {
  if (readMode !== "R")
    throw new Error("DE-Nile requires read-only topic access");
  const decode = options.decode ?? decodeRiverDashValue;
  return {
    subscribe(name, listener) {
      let topic: ReadTopic | undefined;
      let disposed = false;
      const emit = (reading: Reading) => {
        if (!disposed) listener(reading);
      };
      const update = () => {
        if (!topic) return;
        let reading: Reading;
        try {
          reading = {
            status: "available",
            value: decode(topic.read_data()),
            updatedAt: topic.get_last_update_time().toString()
          };
        } catch (error) {
          reading = {
            status: "invalid",
            message:
              error instanceof Error
                ? error.message
                : "Invalid telemetry value"
          };
        }
        emit(reading);
      };
      const open = () => {
        // Reinitialization may replace the topic; detach the previous handle first.
        topic?.removeEventListener(
          "RiverDash:TopicUpdateEvent",
          update
        );
        topic = undefined;
        table.get_topic(name, readMode).match(
          (opened) => {
            topic = opened;
            topic.addEventListener(
              "RiverDash:TopicUpdateEvent",
              update
            );
            update();
          },
          () =>
            emit({
              status: "unavailable",
              message:
                "Topic is missing or waiting for its first value"
            })
        );
      };
      const initialized = (event: Event) => {
        if (
          "m_info" in event &&
          typeof event.m_info === "object" &&
          event.m_info !== null &&
          "name" in event.m_info &&
          event.m_info.name === name
        )
          open();
      };
      // Register before opening so a newly initialized topic cannot be missed.
      table.addEventListener(
        "RiverDash:GDTEventTopicInitialized",
        initialized
      );
      table.addEventListener(
        "RiverDash:GDTEventTopicDeclared",
        initialized
      );
      open();
      return () => {
        disposed = true;
        topic?.removeEventListener(
          "RiverDash:TopicUpdateEvent",
          update
        );
        table.removeEventListener(
          "RiverDash:GDTEventTopicInitialized",
          initialized
        );
        table.removeEventListener(
          "RiverDash:GDTEventTopicDeclared",
          initialized
        );
      };
    }
  };
}

/** Never infer valve semantics from a number: labels come from the diagram. */
export function formatReading(
  binding: Binding | undefined,
  reading: Reading | undefined
): { text: string; color?: string } {
  if (!binding) return { text: "Not bound" };
  if (!reading || reading.status === "unavailable")
    return { text: "Unavailable" };
  if (
    reading.status === "invalid" ||
    typeof reading.value !== binding.valueType
  )
    return { text: "Invalid data" };
  if (binding.states) {
    const state = binding.states.find(
      (item) => item.value === reading.value
    );
    return state
      ? { text: state.label, color: state.color }
      : { text: "Unknown state" };
  }
  const value =
    typeof reading.value === "number"
      ? reading.value.toFixed(binding.precision ?? 1)
      : String(reading.value);
  return {
    text: binding.unit ? `${value} ${binding.unit}` : value
  };
}
