import { extractProfileFromPayload, maxRequestBytes } from "../scripts/profile-extraction.mjs";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    response.status(400).json({ error: "Invalid JSON request body." });
    return;
  }

  const result = await extractProfileFromPayload(payload);
  response.status(result.status).json(result.body);
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
