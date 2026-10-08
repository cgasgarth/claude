/* oxlint-disable typescript/prefer-readonly-parameter-types -- MCP schema inference uses mutable arrays. */
/* oxlint-disable typescript/no-deprecated -- Keep the same MCP Server interface as the shared bridge. */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import type { CallToolResult, Server } from "@modelcontextprotocol/server";
import OpenAI, { toFile } from "openai";
import { z } from "zod";

const IMAGE_INTEGRATION = { id: "image-generation", name: "image-generation", tools: 1 };
const MAX_REFERENCE_IMAGES = 16;
const TIMEOUT_MS = 300_000;
const inputSchema = z.object({
  prompt: z.string().min(1).describe("Describe the image or the changes to make."),
  model: z.enum(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]).default("gpt-image-2.5-flare"),
  referenced_image_paths: z
    .array(z.string().refine(path.isAbsolute, "Use an absolute file path"))
    .min(1)
    .max(MAX_REFERENCE_IMAGES)
    .optional()
    .describe("Local images to edit or use as references. Omit for a new image."),
  background: z.enum(["auto", "opaque", "transparent"]).default("auto"),
  quality: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  size: z.enum(["auto", "1024x1024", "1536x1024", "1024x1536"]).default("auto"),
});
const client = new OpenAI({
  baseURL: "http://127.0.0.1:8318/v1",
  apiKey: "local-vibeproxy",
  timeout: TIMEOUT_MS,
  maxRetries: 0,
});

async function generateImage(
  args: Readonly<z.infer<typeof inputSchema>>,
  signal: Readonly<AbortSignal>,
): Promise<CallToolResult> {
  const { referenced_image_paths: references, ...input } = args;
  const options = { ...input, n: 1, output_format: "png" as const };
  const response =
    references === undefined
      ? await client.images.generate(options, { signal })
      : await client.images.edit(
          {
            ...options,
            image: await Promise.all(
              references.map(async (file) =>
                toFile(Bun.file(file), path.basename(file), { type: Bun.file(file).type }),
              ),
            ),
          },
          { signal },
        );
  const image = response.data?.[0]?.b64_json;
  if (image === undefined) {
    throw new Error("VibeProxy returned no image data.");
  }
  const directory = path.join(homedir(), ".claude/generated_images");
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${randomUUID()}.png`);
  await writeFile(file, Buffer.from(image, "base64"));
  return {
    content: [
      { type: "text", text: `Image saved to ${file}` },
      { type: "image", mimeType: "image/png", data: image },
    ],
  };
}

function createImagesServer(): Server {
  const server = new McpServer({ name: "image-generation", version: "0.1.0" });
  server.registerTool(
    "generate_image",
    {
      description:
        "Generate or edit an image with OpenAI GPT Image through the local VibeProxy Codex connection. Returns the image and its saved local path. Use Flare for generation or Sunburst for precise edits. Takes up to five minutes. No separate OpenAI API key is used.",
      inputSchema,
    },
    async (args, ctx) => {
      try {
        return await generateImage(args, ctx.mcpReq.signal);
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : "Image generation failed",
            },
          ],
        };
      }
    },
  );
  return server.server;
}
export { IMAGE_INTEGRATION, createImagesServer };
