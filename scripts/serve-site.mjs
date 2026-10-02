import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv();

const port = Number(process.env.PORT ?? 4173);
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const maxRequestBytes = 64 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function loadLocalEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const profileSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "goals",
    "capabilities",
    "transferableCapabilities",
    "resources",
    "familyContext",
    "constraints",
    "missingInformation"
  ],
  properties: {
    goals: { type: "array", items: { type: "string" } },
    capabilities: { type: "array", items: { type: "string" } },
    transferableCapabilities: { type: "array", items: { type: "string" } },
    resources: { type: "array", items: { type: "string" } },
    familyContext: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    missingInformation: { type: "array", items: { type: "string" } }
  }
};

function resolveRequestPath(url) {
  const parsed = new URL(url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(root, `.${safePath}`);

  if (!resolved.startsWith(root)) {
    return null;
  }

  return resolved;
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBytes) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

async function handleExtractProfile(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: "Invalid JSON request body." });
    return;
  }

  const story = String(payload.story ?? "").trim();
  const pathways = Array.isArray(payload.pathways)
    ? payload.pathways.map((pathway) => String(pathway).trim()).filter(Boolean)
    : [];

  if (!story) {
    sendJson(response, 400, { error: "Missing required field: story." });
    return;
  }

  if (!openAiApiKey) {
    sendJson(response, 503, {
      error: "OPENAI_API_KEY is not set. Deterministic profile extraction remains the working fallback."
    });
    return;
  }

  try {
    const profile = await extractProfileWithOpenAI(story, pathways);
    sendJson(response, 200, { profile });
  } catch (error) {
    console.error(error);
    sendJson(response, 502, {
      error: "OpenAI profile extraction failed. Deterministic profile extraction remains the working fallback."
    });
  }
}

async function extractProfileWithOpenAI(story, pathways) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "system",
          content: [
            "You extract a structured MAI relocation profile from the user's own story.",
            "Do not invent Abu Dhabi opportunities, official requirements, salaries, costs, visa rules, evidence, source names, or source URLs.",
            "If a critical detail is absent, put it in missingInformation instead of guessing.",
            "Use concise strings. The MAI Opportunity Graph will retrieve opportunities later."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({ story, selectedPathways: pathways })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mai_structured_profile",
          strict: true,
          schema: profileSchema
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const data = await response.json();
  return normalizeProfile(JSON.parse(extractResponseText(data)));
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const content = data.output
    ?.flatMap((item) => item.content ?? [])
    ?.find((item) => item.type === "output_text" && typeof item.text === "string");

  if (!content) {
    throw new Error("OpenAI response did not include output text.");
  }

  return content.text;
}

function normalizeProfile(profile) {
  return Object.fromEntries(
    Object.keys(profileSchema.properties).map((field) => [
      field,
      Array.isArray(profile[field])
        ? profile[field].map((item) => String(item).trim()).filter(Boolean)
        : []
    ])
  );
}

const server = createServer(async (request, response) => {
  const parsed = new URL(request.url ?? "/", `http://localhost:${port}`);

  if (parsed.pathname === "/api/extract-profile") {
    await handleExtractProfile(request, response);
    return;
  }

  const filePath = resolveRequestPath(request.url ?? "/");

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`MAI Relocator site running at http://localhost:${port}`);
});
