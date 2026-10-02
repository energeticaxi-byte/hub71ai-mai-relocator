import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const graphPath = path.join(root, "data", "opportunity-graph.json");

const requiredOpportunityFields = [
  "opportunity_id",
  "title",
  "pathways",
  "capability_match",
  "transferable_capabilities",
  "abu_dhabi_opportunity",
  "why_this_matters_in_abu_dhabi",
  "evidence_refs",
  "missing_evidence",
  "uncertainty_level",
  "gap_questions",
  "what_would_change_assessment",
  "next_responsible_action",
  "demo_classification_hints",
  "guardrails"
];

const evidenceStatuses = new Set(["verified", "partial", "needs_update", "missing"]);
const uncertaintyLevels = new Set(["low", "medium", "high"]);
const pathways = new Set([
  "Career",
  "Career Change",
  "Business",
  "Investment",
  "Education",
  "Family",
  "New Life"
]);

function requireArray(value, minItems, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  if (value.length < minItems) {
    errors.push(`${label} must include at least ${minItems} item(s).`);
  }
}

function validateOpportunity(opportunity, index, seenIds, errors) {
  const label = `opportunities[${index}]`;

  for (const field of requiredOpportunityFields) {
    if (!(field in opportunity)) {
      errors.push(`${label} is missing required field: ${field}`);
    }
  }

  if (seenIds.has(opportunity.opportunity_id)) {
    errors.push(`${label} duplicates opportunity_id ${opportunity.opportunity_id}`);
  }
  seenIds.add(opportunity.opportunity_id);

  if (!/^opp-[a-z0-9-]+$/.test(opportunity.opportunity_id ?? "")) {
    errors.push(`${label}.opportunity_id must start with opp- and use lowercase kebab case.`);
  }

  requireArray(opportunity.pathways, 1, `${label}.pathways`, errors);
  for (const pathway of opportunity.pathways ?? []) {
    if (!pathways.has(pathway)) {
      errors.push(`${label}.pathways includes unknown pathway: ${pathway}`);
    }
  }

  requireArray(opportunity.transferable_capabilities, 1, `${label}.transferable_capabilities`, errors);
  for (const [capIndex, capability] of (opportunity.transferable_capabilities ?? []).entries()) {
    for (const field of ["capability", "from_user_signal", "how_it_transfers"]) {
      if (!capability[field]) {
        errors.push(`${label}.transferable_capabilities[${capIndex}] missing ${field}`);
      }
    }
  }

  requireArray(opportunity.evidence_refs, 1, `${label}.evidence_refs`, errors);
  for (const [evIndex, evidence] of (opportunity.evidence_refs ?? []).entries()) {
    const evLabel = `${label}.evidence_refs[${evIndex}]`;
    for (const field of [
      "evidence_id",
      "claim",
      "source_name",
      "source_url",
      "date_checked",
      "evidence_status",
      "evidence_summary"
    ]) {
      if (!evidence[field]) {
        errors.push(`${evLabel} missing ${field}`);
      }
    }
    if (!/^https?:\/\//.test(evidence.source_url ?? "")) {
      errors.push(`${evLabel}.source_url must be an http(s) URL.`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.date_checked ?? "")) {
      errors.push(`${evLabel}.date_checked must be YYYY-MM-DD.`);
    }
    if (!evidenceStatuses.has(evidence.evidence_status)) {
      errors.push(`${evLabel}.evidence_status is invalid: ${evidence.evidence_status}`);
    }
  }

  if (!uncertaintyLevels.has(opportunity.uncertainty_level)) {
    errors.push(`${label}.uncertainty_level is invalid: ${opportunity.uncertainty_level}`);
  }

  requireArray(opportunity.gap_questions, 1, `${label}.gap_questions`, errors);
  requireArray(opportunity.what_would_change_assessment, 1, `${label}.what_would_change_assessment`, errors);
  requireArray(opportunity.guardrails, 1, `${label}.guardrails`, errors);
}

const graph = JSON.parse(await readFile(graphPath, "utf8"));
const errors = [];

if (graph.dataset_name !== "MAI Abu Dhabi Opportunity Graph") {
  errors.push("dataset_name must be MAI Abu Dhabi Opportunity Graph.");
}

if (!Array.isArray(graph.opportunities)) {
  errors.push("opportunities must be an array.");
} else {
  if (graph.opportunities.length < 12 || graph.opportunities.length > 15) {
    errors.push(`Expected 12-15 opportunities, found ${graph.opportunities.length}.`);
  }

  const seenIds = new Set();
  graph.opportunities.forEach((opportunity, index) => {
    validateOpportunity(opportunity, index, seenIds, errors);
  });
}

if (errors.length > 0) {
  console.error("Opportunity Graph validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const statusCounts = {};
const pathwayCounts = {};
for (const opportunity of graph.opportunities) {
  for (const pathway of opportunity.pathways) {
    pathwayCounts[pathway] = (pathwayCounts[pathway] ?? 0) + 1;
  }
  for (const evidence of opportunity.evidence_refs) {
    statusCounts[evidence.evidence_status] = (statusCounts[evidence.evidence_status] ?? 0) + 1;
  }
}

console.log(`Opportunity Graph OK: ${graph.opportunities.length} opportunities.`);

if (process.argv.includes("--summary")) {
  console.log("Pathways:");
  for (const [pathway, count] of Object.entries(pathwayCounts).sort()) {
    console.log(`- ${pathway}: ${count}`);
  }

  console.log("Evidence statuses:");
  for (const status of ["verified", "partial", "needs_update", "missing"]) {
    console.log(`- ${status}: ${statusCounts[status] ?? 0}`);
  }

  console.log("Records marked needs_update:");
  for (const opportunity of graph.opportunities) {
    const needsUpdate = opportunity.evidence_refs.filter(
      (evidence) => evidence.evidence_status === "needs_update"
    );
    if (needsUpdate.length > 0) {
      console.log(`- ${opportunity.opportunity_id}: ${needsUpdate.map((evidence) => evidence.evidence_id).join(", ")}`);
    }
  }
}
