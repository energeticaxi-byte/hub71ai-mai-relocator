const screens = ["story", "understand", "gate", "your-request", "other-possibilities", "compare"];
const screenDependencies = {
  story: () => true,
  understand: () => !!state.profile,
  gate: () => !!state.profile,
  "your-request": () => state.directOpportunities.length > 0,
  "other-possibilities": () => state.directOpportunities.length > 0,
  compare: () => state.directOpportunities.length > 0
};
const profileFields = [
  "goals",
  "capabilities",
  "transferableCapabilities",
  "resources",
  "familyContext",
  "constraints",
  "missingInformation"
];

const fieldLabels = {
  goals: "Goals",
  capabilities: "Capabilities",
  transferableCapabilities: "Transferable Capabilities",
  resources: "Resources",
  familyContext: "Family Context",
  constraints: "Constraints",
  missingInformation: "Missing Information"
};

const monthlyLifeFields = [
  { key: "expectedNetIncome", label: "Expected Net Income", type: "income" },
  { key: "housing", label: "Housing", type: "monthlyCost" },
  { key: "education", label: "Education", type: "monthlyCost" },
  { key: "transport", label: "Transport", type: "monthlyCost" },
  { key: "healthcare", label: "Healthcare", type: "monthlyCost" },
  { key: "otherLivingCosts", label: "Other Living Costs", type: "monthlyCost" }
];

const initialLifeFields = [
  { key: "visaRelocation", label: "Visa & Relocation" },
  { key: "housingSetup", label: "Housing Deposit / Setup" },
  { key: "educationSetup", label: "Education Setup" },
  { key: "careerTransition", label: "Career Transition / Training" },
  { key: "businessSetup", label: "Business Setup" },
  { key: "otherInitialCosts", label: "Other Initial Costs" }
];

const serviceOptions = [
  "Business Setup",
  "Visa & Residency",
  "Immigration Filing Support",
  "Accounting & Tax",
  "Banking & Financial Setup",
  "Housing & Relocation",
  "Education & Family Support",
  "Flights & Arrival"
];

const state = {
  graph: null,
  story: "",
  selectedPathways: new Set(),
  profile: null,
  evidenceGate: {
    answers: [],
    unansweredQuestions: []
  },
  directOpportunities: [],
  adjacentOpportunities: [],
  selectedOpportunityIds: new Set(),
  lifeInputs: {},
  assistanceRequests: [],
  currentScreen: "story"
};

const imageAvailability = new Map();

const demoStory = `I am an AI product manager with eight years of experience building automation and data products. I have also helped a small startup launch an MVP and run pilots with enterprise clients. My spouse and two children would relocate with me, so schools and family planning matter. I want to explore career and business possibilities in Abu Dhabi, especially AI startup pathways, but I need to understand what evidence is missing before making decisions.`;

const stopWords = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "abu",
  "been",
  "before",
  "business",
  "but",
  "can",
  "career",
  "dhabi",
  "does",
  "for",
  "from",
  "have",
  "help",
  "into",
  "life",
  "make",
  "need",
  "only",
  "that",
  "the",
  "them",
  "this",
  "through",
  "want",
  "what",
  "with",
  "would",
  "your"
]);

const signalMap = [
  {
    terms: ["ai", "artificial intelligence", "automation", "machine learning", "data", "product"],
    capability: "AI product and data capability",
    transferable: "AI product building can transfer into startup, education, specialist, or employment exploration."
  },
  {
    terms: ["startup", "founder", "mvp", "pilot", "venture", "scale"],
    capability: "Startup execution experience",
    transferable: "Founder and MVP experience can transfer into Abu Dhabi ecosystem pathways."
  },
  {
    terms: ["family", "children", "child", "school", "spouse", "wife", "husband", "partner"],
    capability: "Family relocation planning",
    transferable: "Family context transfers into school, housing, timing, and evidence-gate planning."
  },
  {
    terms: ["remote", "employer outside", "digital nomad"],
    capability: "Location-independent work",
    transferable: "Remote income can transfer into non-employer-led relocation exploration if official criteria are verified."
  },
  {
    terms: ["health", "doctor", "nurse", "clinical", "medical", "biotech", "medtech"],
    capability: "Healthcare or life-sciences expertise",
    transferable: "Health expertise can transfer into licensing, innovation, or life-sciences startup routes."
  },
  {
    terms: ["fintech", "finance", "banking", "payments", "compliance", "regulated"],
    capability: "Financial technology or regulated-sector experience",
    transferable: "Finance and compliance capability can transfer into ADGM or RegLab exploration."
  },
  {
    terms: ["creative", "media", "gaming", "design", "artist", "film"],
    capability: "Creative portfolio or media capability",
    transferable: "Creative evidence can transfer into creative visa, freelance, or media free-zone exploration."
  },
  {
    terms: ["property", "real estate", "invest", "investment", "capital"],
    capability: "Investment planning capability",
    transferable: "Capital allocation can transfer into property, business setup, or investor evidence checks."
  },
  {
    terms: ["study", "education", "research", "masters", "phd", "graduate"],
    capability: "Academic or research readiness",
    transferable: "Academic capability can transfer into Abu Dhabi education-led relocation pathways."
  },
  {
    terms: ["climate", "sustainability", "carbon", "water"],
    capability: "Sustainability or climate capability",
    transferable: "Climate expertise can transfer into Hub71+ ClimateTech or sustainability partner exploration."
  }
];

async function init() {
  bindEvents();
  hydrateBrandLogo();
  showScreen("story");

  try {
    state.graph = await loadGraph();
    setStoryHint("Add your story or load the demo journey to unlock the rest of the flow.", "");
  } catch (error) {
    console.error(error);
    setStoryHint("Opportunity Graph did not load. Open the site through http://localhost:4173, then reload.", "warning");
  }
}

async function loadGraph() {
  const response = await fetch("./data/opportunity-graph.json");
  if (!response.ok) {
    throw new Error(`Failed to load Opportunity Graph: ${response.status}`);
  }
  return response.json();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const exploreButton = event.target.closest("[data-explore-opportunity]");
    if (!exploreButton) return;

    state.selectedOpportunityIds = new Set([exploreButton.dataset.exploreOpportunity]);
    renderCompare();
    showScreen("compare");
  });

  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-life-input]");
    if (!input) return;

    const opportunityId = input.dataset.opportunityId;
    state.lifeInputs[opportunityId] = {
      ...(state.lifeInputs[opportunityId] ?? {}),
      [input.dataset.lifeInput]: input.value
    };
    updateLifeCalculator(opportunityId);
  });

  document.addEventListener("click", (event) => {
    const requestButton = event.target.closest("[data-open-assistance]");
    if (requestButton) {
      const form = document.querySelector(`[data-assistance-form="${cssEscape(requestButton.dataset.openAssistance)}"]`);
      form?.classList.remove("hidden");
      return;
    }

    const continueButton = event.target.closest("[data-close-assistance]");
    if (continueButton) {
      const form = document.querySelector(`[data-assistance-form="${cssEscape(continueButton.dataset.closeAssistance)}"]`);
      form?.classList.add("hidden");
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-assistance-form]");
    if (!form) return;

    event.preventDefault();
    const formData = new FormData(form);
    state.assistanceRequests.push({
      opportunityId: form.dataset.assistanceForm,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      selectedFuture: String(formData.get("selectedFuture") ?? ""),
      services: formData.getAll("services").map(String),
      preferredContact: String(formData.get("preferredContact") ?? ""),
      consent: formData.get("consent") === "on"
    });
    form.querySelector("[data-assistance-status]").textContent = "Request captured for demonstration purposes.";
  });

  document.querySelectorAll(".pathway-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const pathway = chip.dataset.pathway;
      if (state.selectedPathways.has(pathway)) {
        state.selectedPathways.delete(pathway);
        chip.classList.remove("selected");
      } else {
        state.selectedPathways.add(pathway);
        chip.classList.add("selected");
      }
    });
  });

  document.querySelector("#load-demo").addEventListener("click", () => {
    document.querySelector("#story-input").value = demoStory;
    setPathways(["Career", "Business", "Family"]);
    setStoryHint("Demo story loaded. Click Explore My Possibilities to see all six screens.", "ready");
  });

  document.querySelector("#start-journey").addEventListener("click", async () => {
    if (!state.graph) {
      setStoryHint("Opportunity Graph is still loading or did not load. Use http://localhost:4173 and reload the page.", "warning");
      return;
    }

    const startButton = document.querySelector("#start-journey");
    startButton.disabled = true;
    state.story = document.querySelector("#story-input").value.trim();
    if (!state.story) {
      document.querySelector("#story-input").value = demoStory;
      setPathways(["Career", "Business", "Family"]);
      state.story = demoStory;
      setStoryHint("No story was entered, so the demo journey was loaded automatically.", "ready");
    }

    setStoryHint("Understanding your story...", "ready");

    const selectedPathways = Array.from(state.selectedPathways);
    const profileResult = await getStructuredProfile(state.story, selectedPathways);
    state.profile = profileResult.profile;
    state.evidenceGate = {
      answers: [],
      unansweredQuestions: []
    };
    retrieveOpportunities();
    state.selectedOpportunityIds = new Set(state.directOpportunities.slice(0, 2).map((opportunity) => opportunity.opportunity_id));
    renderUnderstand();
    setStoryHint(profileResult.message, "ready");
    showScreen("understand");
    startButton.disabled = false;
  });

  document.querySelectorAll("[data-next]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.currentScreen === "understand") {
        saveProfileCorrections();
        renderEvidenceGate();
      }
      if (state.currentScreen === "gate") {
        captureEvidenceGateAnswers();
        retrieveOpportunities();
        renderYourRequest();
      }
      if (state.currentScreen === "your-request") {
        renderOtherPossibilities();
      }
      if (state.currentScreen === "other-possibilities") {
        renderCompare();
      }
      showScreen(button.dataset.next);
    });
  });

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => {
      const currentIndex = screens.indexOf(state.currentScreen);
      showScreen(screens[Math.max(0, currentIndex - 1)]);
    });
  });

  document.querySelector("[data-reset]").addEventListener("click", () => {
    state.selectedOpportunityIds.clear();
    state.story = "";
    state.selectedPathways.clear();
    state.profile = null;
    state.evidenceGate = {
      answers: [],
      unansweredQuestions: []
    };
    state.directOpportunities = [];
    state.adjacentOpportunities = [];
    state.lifeInputs = {};
    state.assistanceRequests = [];
    document.querySelector("#story-input").value = "";
    setPathways([]);
    setStoryHint("Add your story or load the demo journey to unlock the rest of the flow.", "");
    showScreen("story");
  });

  document.querySelectorAll("[data-step-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.stepJump;
      if (screenDependencies[target]()) {
        if (state.currentScreen === "understand") {
          saveProfileCorrections();
        }
        if (state.currentScreen === "gate" && target !== "gate") {
          captureEvidenceGateAnswers();
          retrieveOpportunities();
        }
        if (target === "gate") renderEvidenceGate();
        if (target === "your-request") renderYourRequest();
        if (target === "other-possibilities") renderOtherPossibilities();
        if (target === "compare") renderCompare();
        showScreen(target);
      } else {
        setStoryHint("Start with Your Story first. Load the demo journey for a complete walkthrough.", "warning");
        showScreen("story");
      }
    });
  });
}

function setPathways(pathways) {
  state.selectedPathways = new Set(pathways);
  document.querySelectorAll(".pathway-chip").forEach((chip) => {
    chip.classList.toggle("selected", state.selectedPathways.has(chip.dataset.pathway));
  });
}

function showScreen(screen) {
  state.currentScreen = screen;
  document.querySelectorAll(".screen").forEach((section) => {
    section.classList.toggle("active", section.dataset.screen === screen);
  });
  updateFlowNav();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateFlowNav() {
  document.querySelectorAll("[data-step-jump]").forEach((button) => {
    const step = button.dataset.stepJump;
    const unlocked = screenDependencies[step]();
    button.classList.toggle("active", step === state.currentScreen);
    button.classList.toggle("locked", !unlocked);
    button.disabled = false;
    button.setAttribute("aria-disabled", String(!unlocked));
  });
}

function setStoryHint(message, tone) {
  const hint = document.querySelector("#story-hint");
  hint.textContent = message;
  hint.classList.toggle("warning", tone === "warning");
  hint.classList.toggle("ready", tone === "ready");
}

async function getStructuredProfile(story, selectedPathways) {
  try {
    const profile = await requestOpenAiProfile(story, selectedPathways);
    return {
      profile,
      message: "Story understood with AI. Review and correct the profile below."
    };
  } catch {
    return {
      profile: extractProfile(story, selectedPathways),
      message: "Structured locally. Review and correct the profile below."
    };
  }
}

async function requestOpenAiProfile(story, selectedPathways) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("/api/extract-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story, pathways: selectedPathways }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Profile extraction unavailable.");
    }

    const payload = await response.json();
    return normalizeExtractedProfile(payload.profile);
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeExtractedProfile(profile) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Invalid profile payload.");
  }

  return Object.fromEntries(
    profileFields.map((field) => {
      if (!Array.isArray(profile[field])) {
        throw new Error("Invalid profile field.");
      }
      return [
        field,
        profile[field].map((item) => String(item).trim()).filter(Boolean)
      ];
    })
  );
}

function extractProfile(story, selectedPathways) {
  const lowerStory = story.toLowerCase();
  const matchedSignals = signalMap.filter((signal) => signal.terms.some((term) => termMatches(lowerStory, term)));

  const capabilities = unique([
    ...matchedSignals.map((signal) => signal.capability),
    selectedPathways.includes("Business") ? "Business exploration intent" : "",
    selectedPathways.includes("Career") ? "Career exploration intent" : ""
  ]).filter(Boolean);

  const transferableCapabilities = unique(matchedSignals.map((signal) => signal.transferable));
  const missingInformation = buildMissingInformation(lowerStory, selectedPathways);

  return {
    goals: unique([
      selectedPathways.length ? `Explore ${selectedPathways.join(", ")} pathways in Abu Dhabi.` : "Explore possible Abu Dhabi futures.",
      lowerStory.includes("evidence") || lowerStory.includes("missing")
        ? "Understand missing evidence before making decisions."
        : "Understand what would make each future real."
    ]),
    capabilities: capabilities.length ? capabilities : ["General professional and relocation exploration capability"],
    transferableCapabilities: transferableCapabilities.length
      ? transferableCapabilities
      : ["Current experience may transfer into more than one Abu Dhabi pathway, but more detail is needed."],
    resources: inferResources(lowerStory),
    familyContext: inferFamilyContext(lowerStory),
    constraints: inferConstraints(lowerStory),
    missingInformation
  };
}

function inferResources(lowerStory) {
  const resources = [];
  if (lowerStory.includes("mvp") || lowerStory.includes("pilot")) {
    resources.push("Existing product, MVP, or pilot evidence may be available.");
  }
  if (lowerStory.includes("client") || lowerStory.includes("enterprise")) {
    resources.push("Client or enterprise experience may support opportunity fit.");
  }
  if (lowerStory.includes("capital") || lowerStory.includes("invest")) {
    resources.push("Investment resources mentioned; amount and purpose still need verification.");
  }
  if (lowerStory.includes("remote")) {
    resources.push("Remote work may be a resource if employer, income, and application route are verified.");
  }
  return resources.length ? resources : ["No specific capital, employment offer, product traction, or school plan has been verified yet."];
}

function inferFamilyContext(lowerStory) {
  const family = [];
  if (["spouse", "wife", "husband", "partner"].some((term) => termMatches(lowerStory, term))) {
    family.push("Spouse or partner relocation context mentioned.");
  }
  if (lowerStory.includes("children") || lowerStory.includes("child") || lowerStory.includes("school")) {
    family.push("Children or schooling context mentioned.");
  }
  return family.length ? family : ["No family or dependent details provided yet."];
}

function inferConstraints(lowerStory) {
  const constraints = [];
  if (lowerStory.includes("school")) constraints.push("School fit and timing may constrain relocation decisions.");
  if (lowerStory.includes("evidence") || lowerStory.includes("missing")) constraints.push("User wants evidence gaps surfaced before acting.");
  if (lowerStory.includes("regulated")) constraints.push("Regulated-sector approvals may constrain action.");
  return constraints.length ? constraints : ["Timeline, budget, visa route, and risk tolerance still need clarification."];
}

function buildMissingInformation(lowerStory, selectedPathways) {
  const missing = [];
  if (selectedPathways.includes("Career")) missing.push("Target role, seniority, salary needs, and current live vacancies.");
  if (selectedPathways.includes("Business")) missing.push("Startup stage, traction, founder availability, and regulatory exposure.");
  if (selectedPathways.includes("Family")) missing.push("Children's ages, curriculum needs, school timing, and housing preferences.");
  if (selectedPathways.includes("Investment")) missing.push("Investment budget, risk tolerance, and exact asset/business target.");
  if (!lowerStory.includes("timeline")) missing.push("Relocation timeline.");
  if (!lowerStory.includes("visa")) missing.push("Current visa or residency route.");
  return unique(missing);
}

function termMatches(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function retrieveOpportunities() {
  const selectedPathways = Array.from(state.selectedPathways);
  const matchingText = getMatchingText();
  const scored = state.graph.opportunities.map((opportunity) => ({
    opportunity,
    score: scoreOpportunity(opportunity, matchingText, selectedPathways),
    direct: selectedPathways.some((pathway) => opportunity.pathways.includes(pathway))
  }));

  state.directOpportunities = scored
    .filter((item) => item.direct)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.opportunity);

  const directIds = new Set(state.directOpportunities.map((opportunity) => opportunity.opportunity_id));
  state.adjacentOpportunities = scored
    .filter((item) => !directIds.has(item.opportunity.opportunity_id) && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.opportunity);

  if (state.adjacentOpportunities.length < 3) {
    const extras = scored
      .filter((item) => !directIds.has(item.opportunity.opportunity_id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3 - state.adjacentOpportunities.length)
      .map((item) => item.opportunity);
    state.adjacentOpportunities = uniqueById([...state.adjacentOpportunities, ...extras]);
  }
}

function getMatchingText() {
  const structuredProfileText = state.profile
    ? profileFields.flatMap((field) => state.profile[field] ?? []).join(" ")
    : "";
  const userProvidedEvidence = state.evidenceGate.answers
    .map((item) => `${item.question} ${item.answer}`)
    .join(" ");
  return `${state.story} ${structuredProfileText} ${userProvidedEvidence}`.trim();
}

function scoreOpportunity(opportunity, story, selectedPathways) {
  const lowerStory = story.toLowerCase();
  const opportunityText = JSON.stringify(opportunity).toLowerCase();
  let score = 0;

  for (const signal of signalMap) {
    const matchedTerms = signal.terms.filter((term) => termMatches(lowerStory, term));
    for (const term of matchedTerms) {
      if (termMatches(opportunityText, term)) score += 6;
    }
  }

  for (const pathway of selectedPathways) {
    if (opportunity.pathways.includes(pathway)) score += 3;
  }

  score += getCuratedBoost(opportunity.opportunity_id, lowerStory, selectedPathways);

  return score;
}

function getCuratedBoost(opportunityId, lowerStory, selectedPathways) {
  const hasAny = (terms) => terms.some((term) => termMatches(lowerStory, term));
  let boost = 0;

  if (hasAny(["ai", "artificial intelligence", "automation", "machine learning", "data product"])) {
    boost += boostFor(opportunityId, {
      "opp-ai-startup-founder-hub71-ai": 24,
      "opp-ai-graduate-study-mbzuai": 12,
      "opp-golden-visa-specialist-researcher": 8,
      "opp-preseed-startup-founder-hub71-access": 6
    });
  }

  if (hasAny(["startup", "founder", "mvp", "pilot", "venture", "scale"])) {
    boost += boostFor(opportunityId, {
      "opp-preseed-startup-founder-hub71-access": 24,
      "opp-ai-startup-founder-hub71-ai": 16,
      "opp-freelance-consulting-added": 6
    });
  }

  if (hasAny(["family", "children", "child", "school", "spouse", "wife", "husband", "partner"])) {
    boost += boostFor(opportunityId, {
      "opp-family-school-planning-adek": 24,
      "opp-real-estate-investor-residency-check": 6,
      "opp-remote-worker-new-life-adro": 4
    });
  }

  if (hasAny(["remote", "employer outside", "digital nomad"])) {
    boost += boostFor(opportunityId, {
      "opp-remote-worker-new-life-adro": 24,
      "opp-freelance-consulting-added": 8
    });
  }

  if (hasAny(["health", "doctor", "nurse", "clinical", "medical", "biotech", "medtech"])) {
    boost += boostFor(opportunityId, {
      "opp-healthcare-professional-licensing-doh": 24,
      "opp-life-sciences-startup-healthx-hub71": 18
    });
  }

  if (hasAny(["fintech", "finance", "banking", "payments", "compliance", "regulated"])) {
    boost += boostFor(opportunityId, {
      "opp-fintech-reglab-adgm": 24,
      "opp-golden-visa-specialist-researcher": 6
    });
  }

  if (hasAny(["creative", "media", "gaming", "design", "artist", "film"])) {
    boost += boostFor(opportunityId, {
      "opp-creative-professional-dct-twofour54": 24
    });
  }

  if (hasAny(["property", "real estate", "invest", "investment", "capital"])) {
    boost += boostFor(opportunityId, {
      "opp-real-estate-investor-residency-check": 24,
      "opp-industrial-trade-setup-kezad": 8
    });
  }

  if (hasAny(["study", "education", "research", "masters", "phd", "graduate"])) {
    boost += boostFor(opportunityId, {
      "opp-ai-graduate-study-mbzuai": 18,
      "opp-research-graduate-nyuad-ku": 16
    });
  }

  if (hasAny(["climate", "sustainability", "carbon", "water"])) {
    boost += boostFor(opportunityId, {
      "opp-climatetech-founder-hub71-climatetech": 24
    });
  }

  if (selectedPathways.includes("Business")) {
    boost += boostFor(opportunityId, {
      "opp-ai-startup-founder-hub71-ai": 6,
      "opp-preseed-startup-founder-hub71-access": 6,
      "opp-freelance-consulting-added": 4
    });
  }

  if (selectedPathways.includes("Family")) {
    boost += boostFor(opportunityId, {
      "opp-family-school-planning-adek": 8
    });
  }

  return boost;
}

function boostFor(opportunityId, weights) {
  return weights[opportunityId] ?? 0;
}

function renderUnderstand() {
  const editor = document.querySelector("#profile-editor");
  editor.innerHTML = profileFields
    .map((field) => {
      const value = state.profile[field].join("\n");
      return `
        <article class="profile-card">
          <label for="profile-${field}">${fieldLabels[field]}</label>
          <textarea id="profile-${field}" data-profile-field="${field}">${escapeHtml(value)}</textarea>
        </article>
      `;
    })
    .join("");
}

function saveProfileCorrections() {
  document.querySelectorAll("[data-profile-field]").forEach((input) => {
    const field = input.dataset.profileField;
    state.profile[field] = input.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  });
}

function renderEvidenceGate() {
  renderList("#known-list", [
    ...state.profile.goals,
    ...state.profile.capabilities.slice(0, 4),
    `Selected pathways: ${Array.from(state.selectedPathways).join(", ") || "None selected"}`
  ]);

  const verificationItems = unique(
    state.directOpportunities
      .slice(0, 4)
      .flatMap((opportunity) => opportunity.missing_evidence.slice(0, 2))
  );
  renderList("#verify-list", verificationItems);

  renderList("#missing-list", state.profile.missingInformation);

  const questions = unique([
    ...state.profile.missingInformation.slice(0, 3).map((item) => `Please clarify: ${item}`),
    ...state.directOpportunities.slice(0, 2).flatMap((opportunity) => opportunity.gap_questions.slice(0, 1))
  ]).slice(0, 5);

  document.querySelector("#critical-questions").innerHTML = questions
    .map((question, index) => `
      <label class="question-row" for="question-${index}">
        <span>${escapeHtml(question)}</span>
        <input
          id="question-${index}"
          type="text"
          data-critical-question="${escapeAttribute(question)}"
          value="${escapeAttribute(getSavedGateAnswer(question))}"
          placeholder="Optional answer. Leave blank to keep marked as missing."
        />
      </label>
    `)
    .join("");
}

function captureEvidenceGateAnswers() {
  const answers = [];
  const unansweredQuestions = [];

  document.querySelectorAll("[data-critical-question]").forEach((input) => {
    const question = input.dataset.criticalQuestion;
    const answer = input.value.trim();
    if (answer) {
      answers.push({ question, answer });
    } else {
      unansweredQuestions.push(question);
    }
  });

  state.evidenceGate = { answers, unansweredQuestions };
  if (state.profile) {
    const answeredMissingItems = new Set(answers.map((item) => questionToMissingItem(item.question)));
    state.profile.userProvidedEvidence = answers.map((item) => `${item.question} ${item.answer}`);
    state.profile.remainingCriticalQuestions = unansweredQuestions;
    state.profile.missingInformation = unique([
      ...state.profile.missingInformation.filter((item) => !answeredMissingItems.has(item)),
      ...unansweredQuestions.map(questionToMissingItem)
    ]);
  }
}

function getSavedGateAnswer(question) {
  const saved = state.evidenceGate.answers.find((item) => item.question === question);
  return saved?.answer ?? "";
}

function questionToMissingItem(question) {
  return question.replace(/^Please clarify:\s*/i, "");
}

function renderYourRequest() {
  renderOpportunityGrid("#your-request-grid", state.directOpportunities, "direct");
}

function renderOtherPossibilities() {
  renderOpportunityGrid("#other-grid", state.adjacentOpportunities, "adjacent");
}

function renderOpportunityGrid(selector, opportunities, mode) {
  const grid = document.querySelector(selector);
  if (!opportunities.length) {
    grid.innerHTML = `<div class="empty-state">No matching possibilities yet. Add more story detail or select another pathway.</div>`;
    return;
  }

  grid.innerHTML = opportunities.map((opportunity) => renderOpportunityCard(opportunity, mode)).join("");
  hydratePossibilityAssets(grid);
  grid.querySelectorAll("[data-select-opportunity]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedOpportunityIds.add(input.value);
      } else {
        state.selectedOpportunityIds.delete(input.value);
      }
    });
  });
}

function renderOpportunityCard(opportunity, mode) {
  const selected = state.selectedOpportunityIds.has(opportunity.opportunity_id);
  const reason =
    mode === "direct"
      ? "Appeared because its pathway overlaps with what you asked to explore."
      : buildAdjacentReason(opportunity);
  const assetName = getPossibilityAssetName(opportunity);

  return `
    <article class="opportunity-card">
      ${renderPossibilityAssetSlot(assetName, "card")}
      <div class="meta-row">${opportunity.pathways.map((pathway) => `<span class="meta">${escapeHtml(pathway)}</span>`).join("")}</div>
      <h3>${escapeHtml(opportunity.title)}</h3>
      <p>${escapeHtml(opportunity.abu_dhabi_opportunity.description)}</p>
      <p class="soft-text">${escapeHtml(reason)}</p>
      <div class="status-row">${opportunity.evidence_refs
        .map((evidence) => `<span class="status ${evidence.evidence_status}">${escapeHtml(evidence.evidence_status.replace("_", " "))}</span>`)
        .join("")}</div>
      <label class="select-card">
        <input type="checkbox" value="${escapeHtml(opportunity.opportunity_id)}" data-select-opportunity ${selected ? "checked" : ""} />
        <span>Select for Explore / Compare</span>
      </label>
      <button class="card-action" type="button" data-explore-opportunity="${escapeAttribute(opportunity.opportunity_id)}">Explore Future</button>
    </article>
  `;
}

function buildAdjacentReason(opportunity) {
  const capability = opportunity.transferable_capabilities[0];
  return `Appeared through transferable capability: ${capability.capability}. ${capability.how_it_transfers}`;
}

function renderCompare() {
  const selected = state.graph.opportunities.filter((opportunity) => state.selectedOpportunityIds.has(opportunity.opportunity_id));
  document.querySelector("#compare-empty").classList.toggle("hidden", selected.length > 0);
  document.querySelector("#compare-list").innerHTML = selected.map(renderFutureDetail).join("");
  hydratePossibilityAssets(document.querySelector("#compare-list"));
}

function renderFutureDetail(opportunity) {
  const capability = opportunity.capability_match.best_fit_user_signals[0];
  const transferable = opportunity.transferable_capabilities[0];
  const evidence = opportunity.evidence_refs;
  const assetName = getPossibilityAssetName(opportunity);

  return `
    <article class="future-detail">
      <div class="future-top">
        <div class="future-top-layout">
          <div>
            <div class="meta-row">${opportunity.pathways.map((pathway) => `<span class="meta">${escapeHtml(pathway)}</span>`).join("")}</div>
            <h3>${escapeHtml(opportunity.title)}</h3>
            <p>${escapeHtml(opportunity.abu_dhabi_opportunity.description)}</p>
          </div>
          ${renderPossibilityAssetSlot(assetName, "future")}
        </div>
        <div class="graph-chain" aria-label="Opportunity Graph chain">
          <span class="chain-node">Person</span><span class="chain-arrow">-></span>
          <span class="chain-node">Capabilities</span><span class="chain-arrow">-></span>
          <span class="chain-node">Transferable Capabilities</span><span class="chain-arrow">-></span>
          <span class="chain-node">Abu Dhabi Opportunity</span><span class="chain-arrow">-></span>
          <span class="chain-node">Evidence</span><span class="chain-arrow">-></span>
          <span class="chain-node">Gaps</span><span class="chain-arrow">-></span>
          <span class="chain-node">Next Responsible Action</span>
        </div>
      </div>

      <div class="future-grid">
        ${renderCell("User Capability", capability)}
        ${renderCell("Transferable Capability", `${transferable.capability}: ${transferable.how_it_transfers}`)}
        ${renderCell("Abu Dhabi Opportunity", `${opportunity.abu_dhabi_opportunity.sector}. Relevant entities: ${opportunity.abu_dhabi_opportunity.relevant_entities.join(", ")}.`)}
        ${renderCell("Why It May Matter In Abu Dhabi", opportunity.why_this_matters_in_abu_dhabi)}
        ${renderCell("Missing Evidence", listToSentence(opportunity.missing_evidence))}
        ${renderEvidenceGateAssessmentCells()}
        ${renderCell("What Would Change The Assessment?", listToSentence(opportunity.what_would_change_assessment))}
        ${renderCell("Next Responsible Action", opportunity.next_responsible_action)}
        ${renderCell("Evidence Sufficiency", `Uncertainty level: ${opportunity.uncertainty_level}. No probability or opaque score is used.`)}
      </div>

      <div class="future-cell" style="border-right:0;">
        <h4>Evidence, Source, Date Checked, Evidence Status</h4>
        ${evidence.map(renderEvidence).join("")}
      </div>

      ${renderLifeCalculator(opportunity)}
      ${renderCommercialCta(opportunity)}
    </article>
  `;
}

function renderEvidenceGateAssessmentCells() {
  const userEvidence = state.evidenceGate.answers.length
    ? state.evidenceGate.answers.map((item) => `${item.question} Answer: ${item.answer}`).join(" ")
    : "No user-provided Evidence Gate answers were captured.";
  const remainingMissing = state.evidenceGate.unansweredQuestions.length
    ? state.evidenceGate.unansweredQuestions.join(" ")
    : "No unanswered critical questions from the Evidence Gate.";

  return `
    ${renderCell("User-Provided Evidence From Evidence Gate", userEvidence)}
    ${renderCell("Remaining Missing Critical Questions", remainingMissing)}
  `;
}

function renderLifeCalculator(opportunity) {
  const opportunityId = opportunity.opportunity_id;
  const isBusiness = isBusinessFuture(opportunity);
  const initialFields = initialLifeFields.filter((field) => isBusiness || field.key !== "businessSetup");

  return `
    <section class="life-calculator" data-life-calculator="${escapeAttribute(opportunityId)}">
      <div class="life-heading">
        <div>
          <h4>Can I Actually Live This Future?</h4>
          <p class="soft-text">Scenario inputs only. These calculations are not verified market facts, predictions, recommendations, or success scores.</p>
        </div>
        <span class="evidence-required">Unknown — evidence required</span>
      </div>

      <div class="life-input-groups">
        <fieldset class="life-input-group">
          <legend>Monthly</legend>
          ${monthlyLifeFields.map((field) => renderLifeInput(opportunityId, field)).join("")}
        </fieldset>
        <fieldset class="life-input-group">
          <legend>Initial / Transition</legend>
          ${initialFields.map((field) => renderLifeInput(opportunityId, field)).join("")}
        </fieldset>
      </div>

      <div class="life-results" data-life-results="${escapeAttribute(opportunityId)}">
        ${renderLifeResults(opportunity)}
      </div>
    </section>
  `;
}

function renderLifeInput(opportunityId, field) {
  const value = state.lifeInputs[opportunityId]?.[field.key] ?? "";
  return `
    <label class="life-input-row">
      <span>${escapeHtml(field.label)}</span>
      <input
        type="number"
        min="0"
        step="100"
        inputmode="decimal"
        placeholder="Unknown"
        value="${escapeAttribute(value)}"
        data-opportunity-id="${escapeAttribute(opportunityId)}"
        data-life-input="${escapeAttribute(field.key)}"
      />
    </label>
  `;
}

function renderLifeResults(opportunity) {
  const inputs = getLifeInputs(opportunity.opportunity_id);
  const isBusiness = isBusinessFuture(opportunity);
  const monthlyCostKeys = monthlyLifeFields.filter((field) => field.type === "monthlyCost").map((field) => field.key);
  const initialKeys = initialLifeFields
    .filter((field) => isBusiness || field.key !== "businessSetup")
    .map((field) => field.key);
  const monthlyCost = sumKnownFields(inputs, monthlyCostKeys);
  const initialTransition = sumKnownFields(inputs, initialKeys);
  const monthlyCostComplete = monthlyCostKeys.every((key) => isKnownNumber(inputs[key]));
  const initialComplete = initialKeys.every((key) => isKnownNumber(inputs[key]));
  const incomeKnown = isKnownNumber(inputs.expectedNetIncome);
  const monthlyBalance = incomeKnown && monthlyCostComplete ? inputs.expectedNetIncome - monthlyCost.total : null;
  const ninetyDayLiving = monthlyCostComplete ? monthlyCost.total * 3 : null;
  const estimatedNinetyDayFunds = ninetyDayLiving !== null && initialComplete ? ninetyDayLiving + initialTransition.total : null;

  return `
    <div class="life-result-grid">
      ${renderLifeResult("Monthly Living Cost", monthlyCostComplete ? formatMoney(monthlyCost.total) : unknownWithKnown(monthlyCost.total))}
      ${renderLifeResult("Monthly Balance", monthlyBalance !== null ? formatMoney(monthlyBalance) : "Unknown — evidence required")}
      ${renderLifeResult("90-Day Living Requirement", ninetyDayLiving !== null ? formatMoney(ninetyDayLiving) : "Unknown — evidence required")}
      ${renderLifeResult("Initial Transition Requirement", initialComplete ? formatMoney(initialTransition.total) : unknownWithKnown(initialTransition.total))}
      ${renderLifeResult("Estimated 90-Day Funds Needed", estimatedNinetyDayFunds !== null ? formatMoney(estimatedNinetyDayFunds) : "Unknown — evidence required")}
    </div>
    <div class="financial-change">
      <h5>What Would Change This Financial Picture?</h5>
      <ul>${getFinancialChangeFactors(inputs, opportunity).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function updateLifeCalculator(opportunityId) {
  const opportunity = state.graph.opportunities.find((item) => item.opportunity_id === opportunityId);
  const results = document.querySelector(`[data-life-results="${cssEscape(opportunityId)}"]`);
  if (!opportunity || !results) return;
  results.innerHTML = renderLifeResults(opportunity);
}

function renderLifeResult(label, value) {
  return `
    <div class="life-result">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function getLifeInputs(opportunityId) {
  const raw = state.lifeInputs[opportunityId] ?? {};
  return Object.fromEntries(
    [...monthlyLifeFields, ...initialLifeFields].map((field) => [field.key, parseScenarioNumber(raw[field.key])])
  );
}

function parseScenarioNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isKnownNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sumKnownFields(inputs, keys) {
  return {
    total: keys.reduce((sum, key) => sum + (isKnownNumber(inputs[key]) ? inputs[key] : 0), 0),
    knownCount: keys.filter((key) => isKnownNumber(inputs[key])).length
  };
}

function formatMoney(value) {
  return `AED ${Math.round(value).toLocaleString("en-US")}`;
}

function unknownWithKnown(total) {
  return total > 0 ? `Unknown — evidence required. Known entered subtotal: ${formatMoney(total)}` : "Unknown — evidence required";
}

function getFinancialChangeFactors(inputs, opportunity) {
  const factors = [];
  if (!isKnownNumber(inputs.expectedNetIncome)) factors.push("Verified salary/income.");
  if (!isKnownNumber(inputs.housing)) factors.push("Confirmed housing choice.");
  if (!isKnownNumber(inputs.education) || !isKnownNumber(inputs.educationSetup)) factors.push("School requirement.");
  if (!isKnownNumber(inputs.visaRelocation)) factors.push("Visa/setup costs.");
  if (!isKnownNumber(inputs.careerTransition)) factors.push("Transition period.");
  if (isBusinessFuture(opportunity) && !isKnownNumber(inputs.businessSetup)) factors.push("Business setup cost evidence.");
  if (!isKnownNumber(inputs.healthcare)) factors.push("Healthcare cost evidence.");
  if (!isKnownNumber(inputs.transport)) factors.push("Transport plan.");
  if (!isKnownNumber(inputs.otherLivingCosts)) factors.push("Other living-cost evidence.");
  return factors.length ? factors : ["Changed income, housing, school, setup, or transition inputs would change this scenario."];
}

function isBusinessFuture(opportunity) {
  const text = `${opportunity.title} ${opportunity.pathways.join(" ")} ${opportunity.abu_dhabi_opportunity.sector}`.toLowerCase();
  return ["business", "startup", "founder", "licence", "license", "free zone", "company"].some((term) => text.includes(term));
}

function renderCommercialCta(opportunity) {
  return `
    <section class="commercial-layer">
      <div class="commercial-copy">
        <p class="eyebrow">Commercial Partner Layer</p>
        <h4>Make This Future Real</h4>
        <p>You've explored the opportunity, evidence, gaps and financial requirements.</p>
        <p>If you want help taking the next step, MAI can connect your selected pathway with relevant Abu Dhabi services.</p>
        <ul class="service-list">${serviceOptions.map((service) => `<li>${escapeHtml(service)}</li>`).join("")}</ul>
        <p class="soft-text">Partner commercial relationships never affect opportunity ranking or MAI evidence assessment.</p>
      </div>
      <div class="commercial-actions">
        <button class="primary-action" type="button" data-open-assistance="${escapeAttribute(opportunity.opportunity_id)}">Request Assistance</button>
        <button class="secondary-action" type="button" data-close-assistance="${escapeAttribute(opportunity.opportunity_id)}">Continue Exploring</button>
      </div>
      ${renderAssistanceForm(opportunity)}
    </section>
  `;
}

function renderAssistanceForm(opportunity) {
  return `
    <form class="assistance-form hidden" data-assistance-form="${escapeAttribute(opportunity.opportunity_id)}">
      <div class="lead-form-grid">
        <label>Name<input name="name" type="text" autocomplete="name" /></label>
        <label>Email<input name="email" type="email" autocomplete="email" /></label>
        <label>Phone / WhatsApp<input name="phone" type="tel" autocomplete="tel" /></label>
        <label>Selected Future<input name="selectedFuture" type="text" value="${escapeAttribute(opportunity.title)}" readonly /></label>
        <label>Preferred Contact Method
          <select name="preferredContact">
            <option value="">Select</option>
            <option>Email</option>
            <option>Phone</option>
            <option>WhatsApp</option>
          </select>
        </label>
      </div>
      <fieldset class="services-needed">
        <legend>Services Needed</legend>
        ${serviceOptions.map((service) => `
          <label><input type="checkbox" name="services" value="${escapeAttribute(service)}" /> ${escapeHtml(service)}</label>
        `).join("")}
      </fieldset>
      <label class="consent-row"><input type="checkbox" name="consent" required /> I consent to this request being captured for demonstration purposes.</label>
      <div class="commercial-actions">
        <button class="primary-action" type="submit">Request Assistance</button>
        <button class="secondary-action" type="button" data-close-assistance="${escapeAttribute(opportunity.opportunity_id)}">Continue Exploring</button>
      </div>
      <p class="form-hint ready" data-assistance-status></p>
    </form>
  `;
}

function getPossibilityAssetName(opportunity) {
  const text = `${opportunity.opportunity_id} ${opportunity.title} ${opportunity.pathways.join(" ")} ${opportunity.abu_dhabi_opportunity.sector}`.toLowerCase();

  if (text.includes("ai") || text.includes("startup") || text.includes("hub71")) return "possibility-ai-startup";
  if (text.includes("family") || text.includes("school")) return "possibility-family";
  if (text.includes("education") || text.includes("research") || text.includes("graduate")) return "possibility-education";
  if (text.includes("investment") || text.includes("real estate") || text.includes("property")) return "possibility-investment";
  if (text.includes("remote") || text.includes("new-life") || text.includes("new life")) return "possibility-new-life";
  if (text.includes("business") || text.includes("licence") || text.includes("license")) return "possibility-business";
  return "possibility-business";
}

function renderPossibilityAssetSlot(assetName, variant) {
  return `
    <div class="possibility-asset ${variant}" data-asset-slot="${escapeAttribute(assetName)}" aria-label="MAI Relocator possibility visual"></div>
  `;
}

function hydrateBrandLogo() {
  const slot = document.querySelector("[data-logo-src]");
  if (!slot) return;

  getAvailableImageSource(slot.dataset.logoSrc).then((src) => {
    if (!src) return;
    const image = new Image();
    image.alt = "";
    image.onload = () => {
      slot.prepend(image);
      slot.classList.add("has-image");
    };
    image.src = src;
  });
}

function hydratePossibilityAssets(root) {
  root.querySelectorAll("[data-asset-slot]").forEach((slot) => {
    const src = `./public/images/${slot.dataset.assetSlot}.png`;
    getAvailableImageSource(src).then((availableSrc) => {
      if (!availableSrc || slot.classList.contains("has-image")) return;
      const image = new Image();
      image.alt = "";
      image.loading = "lazy";
      image.onload = () => {
        slot.prepend(image);
        slot.classList.add("has-image");
      };
      image.src = availableSrc;
    });
  });
}

async function getAvailableImageSource(src) {
  if (imageAvailability.has(src)) {
    return imageAvailability.get(src) ? src : null;
  }

  try {
    const response = await fetch(src, { method: "HEAD", cache: "no-store" });
    imageAvailability.set(src, response.ok);
    return response.ok ? src : null;
  } catch {
    imageAvailability.set(src, false);
    return null;
  }
}

function renderCell(title, body) {
  return `
    <div class="future-cell">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

function renderEvidence(evidence) {
  return `
    <div class="evidence-card">
      <p><strong>Evidence:</strong> ${escapeHtml(evidence.claim)}</p>
      <p><strong>Summary:</strong> ${escapeHtml(evidence.evidence_summary)}</p>
      <div class="evidence-meta">
        <span class="status ${evidence.evidence_status}">${escapeHtml(evidence.evidence_status.replace("_", " "))}</span>
        <span class="meta">Checked ${escapeHtml(evidence.date_checked)}</span>
      </div>
      <p><strong>Source:</strong> <a href="${escapeAttribute(evidence.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(evidence.source_name)}</a></p>
    </div>
  `;
}

function renderList(selector, items) {
  document.querySelector(selector).innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function listToSentence(items) {
  return items.length ? items.join(" ") : "No missing evidence listed in the current Opportunity Graph record.";
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function uniqueById(opportunities) {
  const seen = new Set();
  return opportunities.filter((opportunity) => {
    if (seen.has(opportunity.opportunity_id)) return false;
    seen.add(opportunity.opportunity_id);
    return true;
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

init();
