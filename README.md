# MAI Relocator

**Hub71+ AI Hackathon — Abu Dhabi — 2 October 2026**

MAI Relocator is an AI Decision & Opportunity Navigator for Abu Dhabi.

It helps people and companies explore what futures they could potentially build in Abu Dhabi, test those futures against evidence, understand what is still unknown, and decide what responsible next action to take.

Core principle:

```text
Evidence, Not Guessing.
```

## Problem

Relocation is not only a procedural question. A person may be asking whether to continue a career, change direction, start a business, invest, study, move with family, or build a completely new life.

Most relocation tools either explain generic steps or produce broad recommendations. MAI Relocator instead separates exploration from evidence and keeps the final decision with the human.

## Solution

The product flow is:

```text
User Story
-> OpenAI Understanding
-> MAI Abu Dhabi Opportunity Graph
-> Evidence Gate
-> MAI Assessment
-> Human Choice
```

OpenAI helps understand the user's free-form story. MAI then uses its own structured Opportunity Graph to retrieve Abu Dhabi possibilities, expose evidence, show uncertainty and missing information, and identify next responsible actions.

## OpenAI Role

OpenAI is used for structured profile extraction from the user's story.

It may extract:

- goals
- capabilities
- transferableCapabilities
- resources
- familyContext
- constraints
- missingInformation

OpenAI must not generate final Abu Dhabi opportunities, official requirements, salaries, visa rules, costs, source URLs, evidence, success probabilities, or recommendations.

If OpenAI is unavailable, the prototype falls back to deterministic local extraction so the demo journey continues.

## MAI Abu Dhabi Opportunity Graph

The unique dataset is the **MAI Abu Dhabi Opportunity Graph**.

It connects:

```text
Person -> Capabilities -> Transferable Capabilities -> Abu Dhabi Opportunity -> Evidence -> Gaps -> Next Responsible Action
```

The graph is stored in:

- `data/opportunity-graph.json`
- `data/opportunity-graph.schema.json`

Each opportunity record exposes the evidence chain in the UI, including capability match, transferable capabilities, why the opportunity may matter in Abu Dhabi, evidence references, source URLs, checked dates, evidence status, missing evidence, what would change the assessment, and next responsible action.

## Six-Screen User Journey

1. **Your Story** — free-form story input and pathway chips.
2. **Understand** — editable structured profile.
3. **Evidence Gate** — separates known, needs verification, and missing information.
4. **Your Request** — possibilities directly related to what the user asked to explore.
5. **Other Possibilities** — adjacent possibilities found through transferable capabilities.
6. **Explore / Compare** — selected futures with evidence, gaps, next action, financial scenario inputs, and local assistance request.

## Evidence Gate

The Evidence Gate asks only critical missing questions and preserves unanswered questions as missing. User answers become user-provided evidence and remain visible in later assessment.

The system does not invent missing information.

## Life Calculator

The **Can I Actually Live This Future?** section lets the user test scenario inputs:

- expected net income
- housing
- education
- transport
- healthcare
- other living costs
- visa and relocation
- housing deposit or setup
- education setup
- career transition or training
- business setup, when relevant
- other initial costs

It calculates only from user-entered numbers. Blank values remain **Unknown — evidence required**. The calculator does not insert salary, rent, school, healthcare, visa, or business setup assumptions.

## Make This Future Real

After the user has explored the opportunity, evidence, gaps, and financial requirements, the prototype shows a commercial CTA:

**Make This Future Real**

The local demo lead form can capture interest in services such as business setup, visa and residency, immigration filing support, accounting and tax, banking and financial setup, housing and relocation, education and family support, flights and arrival.

No CRM integration is included in this prototype, and no lead data is sent externally.

Commercial partner relationships are kept separate from the evidence layer and must never influence opportunity ranking or MAI evidence assessment.

## Architecture

This is a dependency-light Node.js web prototype:

- `scripts/serve-site.mjs` serves the website and backend API.
- `POST /api/extract-profile` calls OpenAI from the server only.
- `src/app.js` runs the browser application and deterministic fallback.
- `data/opportunity-graph.json` is the frozen opportunity dataset.
- `scripts/validate-opportunity-graph.mjs` validates the dataset.
- `public/images/` contains approved MAI Relocator visual assets.

The OpenAI API key is read only from the local server environment. It is never placed in browser JavaScript or HTML.

## Local Setup

Requirements:

- Node.js 20 or newer

Create a local environment file:

```bash
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Then paste your API key locally after the equals sign:

```text
OPENAI_API_KEY=
```

Run the prototype:

```bash
npm run dev
```

Open:

```text
http://localhost:4173
```

Validate the Opportunity Graph:

```bash
npm run validate:data
```

Inspect a dataset summary:

```bash
npm run inspect:data
```

## Security Notes

- `.env` is ignored by Git and must not be committed.
- `.env.example` contains only the environment variable name.
- The frontend never receives the OpenAI API key.
- The Opportunity Graph remains the source of Abu Dhabi opportunities and evidence.
