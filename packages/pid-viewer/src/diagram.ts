import { z } from "zod";

const name = z.string().trim().min(1);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");
const scalar = z.union([
  z.string(),
  z.number().finite(),
  z.boolean()
]);

/** Bindings describe display rules; they never contain current telemetry values. */
export const bindingSchema = z
  .object({
    topic: name,
    valueType: z.enum(["number", "string", "boolean"]),
    unit: z.string().optional(),
    precision: z.number().int().min(0).max(6).optional(),
    states: z
      .array(
        z
          .object({
            value: scalar,
            label: name,
            color: color.optional()
          })
          .strict()
      )
      .optional()
  })
  .strict()
  .superRefine((binding, ctx) => {
    const values = new Set<string>();
    binding.states?.forEach((state, index) => {
      if (typeof state.value !== binding.valueType) {
        ctx.addIssue({
          code: "custom",
          path: ["states", index, "value"],
          message: "State value must match valueType"
        });
      }
      const key = JSON.stringify(state.value);
      if (values.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["states", index],
          message: "Duplicate state value"
        });
      values.add(key);
    });
  });

export const equipmentSchema = z
  .object({
    id: name,
    kind: z.enum([
      "tank",
      "check-valve",
      "pneumatic-valve",
      "pressure-transducer",
      "engine"
    ]),
    label: name,
    position: z
      .object({
        x: z.number().finite(),
        y: z.number().finite()
      })
      .strict(),
    binding: bindingSchema.optional()
  })
  .strict();

/** Version 1 is DE-Nile's initial interchange format, pending team review. */
export const diagramSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: name,
    name,
    equipment: z.array(equipmentSchema).min(1),
    connections: z.array(
      z
        .object({
          id: name,
          source: name,
          target: name,
          label: z.string().optional(),
          color: color.default("#667085"),
          routing: z.literal("orthogonal").default("orthogonal")
        })
        .strict()
    )
  })
  .strict()
  .superRefine((diagram, ctx) => {
    const equipmentIds = new Set<string>();
    diagram.equipment.forEach((item, index) => {
      if (equipmentIds.has(item.id))
        ctx.addIssue({
          code: "custom",
          path: ["equipment", index, "id"],
          message: "Duplicate equipment ID"
        });
      equipmentIds.add(item.id);
    });
    const connectionIds = new Set<string>();
    diagram.connections.forEach((edge, index) => {
      if (connectionIds.has(edge.id))
        ctx.addIssue({
          code: "custom",
          path: ["connections", index, "id"],
          message: "Duplicate connection ID"
        });
      connectionIds.add(edge.id);
      for (const endpoint of ["source", "target"] as const) {
        if (!equipmentIds.has(edge[endpoint]))
          ctx.addIssue({
            code: "custom",
            path: ["connections", index, endpoint],
            message: "Unknown equipment ID"
          });
      }
    });
  });

export type Diagram = z.infer<typeof diagramSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type Binding = z.infer<typeof bindingSchema>;
export type Scalar = z.infer<typeof scalar>;

/** Validate parsed JSON or JSON text before it reaches the diagram canvas. */
export function parseDiagram(input: unknown): Diagram {
  return diagramSchema.parse(
    typeof input === "string" ? JSON.parse(input) : input
  );
}
