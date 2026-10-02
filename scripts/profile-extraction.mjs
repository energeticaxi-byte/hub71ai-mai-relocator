export const maxRequestBytes = 64 * 1024;

const defaultOpenAiModel = "gpt-4.1-mini";

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

export async function extractProfileFromPayload(
  payload,
  {
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_MODEL ?? defaultOpenAiModel,
    fetchImpl = fetch,
    logError = console.error
  } = {}
) {
  const story = String(payload.story ?? "").trim();
  const pathways = Array.isArray(payload.pathways)
    ? payload.pathways.map((pathway) => String(pathway).trim()).filter(Boolean)
    : [];

  if (!story) {
    return {
      status: 400,
      body: { error: "Missing required field: story." }
    };
  }

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: "OPENAI_API_KEY is not set. Deterministic profile extraction remains the working fallback."
      }
    };
  }

  try {
    const profile = await extractProfileWithOpenAI(story, pathways, {
      apiKey,
      model,
      fetchImpl
    });

    return {
      status: 200,
      body: { profile }
    };
  } catch (error) {
    logError(error);
    return {
      status: 502,
      body: {
        error: "OpenAI profile extraction failed. Deterministic profile extraction remains the working fallback."
      }
    };
  }
}

async function extractProfileWithOpenAI(story, pathways, { apiKey, model, fetchImpl }) {
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
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
