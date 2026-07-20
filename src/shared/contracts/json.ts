import * as v from 'valibot';

export const JsonPrimitiveSchema = v.union([
  v.string(),
  v.pipe(v.number(), v.finite()),
  v.boolean(),
  v.null(),
]);

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const JsonValueSchema: v.GenericSchema<unknown, JsonValue> = v.lazy(() => v.union([
  JsonPrimitiveSchema,
  v.array(JsonValueSchema),
  v.record(v.string(), JsonValueSchema),
]));

export const JsonObjectSchema = v.record(v.string(), JsonValueSchema);

export function isJsonValue(value: unknown): value is JsonValue {
  return v.safeParse(JsonValueSchema, value).success;
}

export function isShallowObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readSafeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

export function readNullableSafeInteger(value: unknown): number | null {
  return value === null || value === undefined ? null : readSafeInteger(value);
}
