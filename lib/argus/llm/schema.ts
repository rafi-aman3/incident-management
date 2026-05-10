/**
 * Translate JSONSchema (the shape our tool definitions use) to Gemini's
 * OpenAPI-3.0 subset (`Schema` in `@google/genai`). Gemini doesn't accept the
 * lowercase JSONSchema "type" tokens; it wants uppercase OpenAPI tokens
 * (STRING, INTEGER, OBJECT, …). It also rejects `oneOf`, `anyOf`, `allOf`,
 * `$ref`, and conditional schemas — none of which our tools use today.
 *
 * The translator errors loudly on anything outside the supported subset so a
 * future tool author finds the constraint at write time, not at runtime.
 */

import { Type, type Schema } from "@google/genai";
import type { JSONSchemaSubset } from "./types";

const TYPE_MAP: Record<JSONSchemaSubset["type"], Type> = {
  object: Type.OBJECT,
  array: Type.ARRAY,
  string: Type.STRING,
  integer: Type.INTEGER,
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
};

const ALLOWED_KEYS = new Set([
  "type",
  "description",
  "properties",
  "required",
  "items",
  "enum",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "maxLength",
  "minLength",
  "format",
  "nullable",
]);

export function jsonSchemaToGemini(input: JSONSchemaSubset, path = "$"): Schema {
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(
        `JSONSchemaSubset violation at ${path}: unsupported key "${key}". ` +
          `Gemini's OpenAPI subset accepts: ${[...ALLOWED_KEYS].join(", ")}.`,
      );
    }
  }

  const geminiType = TYPE_MAP[input.type];
  if (!geminiType) {
    throw new Error(
      `JSONSchemaSubset violation at ${path}: unknown type "${input.type}".`,
    );
  }

  const out: Schema = { type: geminiType };

  if (input.description !== undefined) out.description = input.description;
  if (input.enum !== undefined) {
    out.enum = input.enum.map((v) => String(v));
  }
  if (input.minimum !== undefined) out.minimum = input.minimum;
  if (input.maximum !== undefined) out.maximum = input.maximum;
  if (input.minItems !== undefined) out.minItems = String(input.minItems);
  if (input.maxItems !== undefined) out.maxItems = String(input.maxItems);
  if (input.maxLength !== undefined) out.maxLength = String(input.maxLength);
  if (input.minLength !== undefined) out.minLength = String(input.minLength);
  if (input.format !== undefined) out.format = input.format;
  if (input.nullable !== undefined) out.nullable = input.nullable;

  if (input.type === "object") {
    if (input.properties) {
      const props: Record<string, Schema> = {};
      for (const [k, v] of Object.entries(input.properties)) {
        props[k] = jsonSchemaToGemini(v, `${path}.${k}`);
      }
      out.properties = props;
    }
    if (input.required && input.required.length > 0) {
      out.required = [...input.required];
    }
  }

  if (input.type === "array") {
    if (!input.items) {
      throw new Error(
        `JSONSchemaSubset violation at ${path}: array type requires \`items\`.`,
      );
    }
    out.items = jsonSchemaToGemini(input.items, `${path}[]`);
  }

  return out;
}
