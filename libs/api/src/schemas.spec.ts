import { describe, expect, it } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';
import { requestBodySchemas } from './schemas.js';

/**
 * Contract drift guard.
 *
 * Generates OpenAPI schema objects from the request Zod schemas and asserts
 * they match the request schemas hand-authored in `openapi.yaml`. Both sides
 * are reduced to a canonical constraint form (type, nullability, format,
 * lengths, pattern, enum, required, nested properties) so cosmetic differences
 * — descriptions, key order, the two equivalent ways OpenAPI 3.1 spells a
 * nullable type — are ignored, while any real constraint drift fails here.
 */

interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  nullable?: boolean;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  minItems?: number;
  enum?: string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
}

interface Normalized {
  type?: string | string[];
  nullable?: true;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  minItems?: number;
  enum?: string[];
  required?: string[];
  properties?: Record<string, Normalized>;
  items?: Normalized;
}

/** `Bun.YAML` is a shipped runtime API not yet in `@types/bun`. */
const parseYaml = (Bun as unknown as { YAML: { parse(input: string): unknown } })
  .YAML.parse;

function normalize(
  schema: JsonSchema,
  components: Record<string, JsonSchema>,
): Normalized {
  if (schema.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    const target = components[name];
    if (!target) throw new Error(`Unresolved $ref: ${schema.$ref}`);
    return normalize(target, components);
  }

  const out: Normalized = {};

  let type = schema.type;
  let nullable = schema.nullable === true;
  if (Array.isArray(type)) {
    nullable = nullable || type.includes('null');
    const nonNull = type.filter((t) => t !== 'null');
    type = nonNull.length === 1 ? nonNull[0] : nonNull;
  }
  if (type !== undefined) out.type = type;
  if (nullable) out.nullable = true;
  if (schema.format !== undefined) out.format = schema.format;
  if (schema.pattern !== undefined) out.pattern = schema.pattern;
  if (schema.minLength !== undefined) out.minLength = schema.minLength;
  if (schema.maxLength !== undefined) out.maxLength = schema.maxLength;
  if (schema.minimum !== undefined) out.minimum = schema.minimum;
  if (schema.minItems !== undefined) out.minItems = schema.minItems;
  if (schema.enum !== undefined) out.enum = [...schema.enum].sort();
  if (schema.required && schema.required.length > 0) {
    out.required = [...schema.required].sort();
  }
  if (schema.properties !== undefined) {
    const props: Record<string, Normalized> = {};
    for (const key of Object.keys(schema.properties).sort()) {
      props[key] = normalize(schema.properties[key]!, components);
    }
    out.properties = props;
  }
  if (schema.items !== undefined) {
    out.items = normalize(schema.items, components);
  }
  return out;
}

const openapiUrl = new URL('../openapi.yaml', import.meta.url);
const openapiDoc = parseYaml(await Bun.file(openapiUrl).text()) as {
  components: { schemas: Record<string, JsonSchema> };
};
const contractSchemas = openapiDoc.components.schemas;

const registry = new OpenAPIHono();
for (const [name, schema] of Object.entries(requestBodySchemas)) {
  registry.openAPIRegistry.register(name, schema);
}
const generatedSchemas = registry.getOpenAPIDocument({
  openapi: '3.1.0',
  info: { title: 'generated', version: '0' },
}).components?.schemas as Record<string, JsonSchema>;

describe('request schemas match openapi.yaml', () => {
  for (const name of Object.keys(requestBodySchemas)) {
    it(`${name} has no constraint drift`, () => {
      const contract = contractSchemas[name];
      expect(contract, `${name} is missing from openapi.yaml`).toBeDefined();

      const fromZod = normalize(generatedSchemas[name]!, generatedSchemas);
      const fromYaml = normalize(contract!, contractSchemas);
      expect(fromZod).toEqual(fromYaml);
    });
  }
});
