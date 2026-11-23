import type { ToolDef, ToolProperty } from './tools';

// Convert our provider-agnostic tool defs into Gemini's functionDeclarations
// shape (OpenAPI schema with UPPERCASE types). Shared by GeminiProvider (chat)
// and GeminiLiveClient (voice), which use the identical format.

const geminiType = (t: ToolProperty['type']) =>
  ({ string: 'STRING', number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN' })[t];

export function geminiFunctionDeclarations(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, p]) => [
          k,
          { type: geminiType(p.type), description: p.description, ...(p.enum ? { enum: p.enum } : {}) },
        ]),
      ),
      required: t.parameters.required ?? [],
    },
  }));
}

/** Full `tools` array as Gemini expects it: `[{ functionDeclarations: [...] }]`. */
export const geminiTools = (tools: ToolDef[]) => [{ functionDeclarations: geminiFunctionDeclarations(tools) }];
