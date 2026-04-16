"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { PromptLibrary } from "../lib/project-store";
import type { GeoTargetSnapshot, WorkbookSummary } from "../lib/workbook-import";
import { saveProjectAction, updateProjectAction, type SaveProjectState } from "./actions";

const initialState: SaveProjectState = {
  status: "idle",
  message: ""
};

const CREATE_DRAFT_STORAGE_KEY = "nls-create-draft-v2";

const wizardSteps = [
  { id: "basic", label: "Basic information", title: "Brand and site identity", description: "Define the site record, niche identity, and manual Ringba setup." },
  { id: "seo", label: "SEO focus", title: "Main niche and keyword structure", description: "Set the main niche and keyword direction for the project." },
  { id: "services", label: "Services", title: "Micro-niches and service coverage", description: "Map the services and micro-niches that will shape the site." },
  { id: "geo", label: "Geo targeting", title: "Import and review service areas", description: "Select the states and city targets this niche should launch with." },
  { id: "design", label: "Design system", title: "Template family and visual direction", description: "Choose the design family, colors, typography, and image rules." },
  { id: "ai", label: "AI and prompts", title: "Provider settings and content controls", description: "Store provider keys and define the generation direction for this project." },
  { id: "review", label: "Review", title: "Review and save project", description: "Confirm the niche, geo, design, and AI settings before saving." }
] as const;

type StepId = (typeof wizardSteps)[number]["id"];
type AssistKind = "basic" | "keywords" | "services" | "design";

type ProjectFormProps = {
  defaults: {
    siteName: string;
    brandName: string;
    primaryDomain: string;
    mainNiche: string;
    mainKeywordTargets: string;
    microNicheKeywords: string;
    tollFreeNumber: string;
    campaignId: string;
    routingNotes: string;
    templateFamily: string;
    primaryColor: string;
    accentColor: string;
    fontHeading: string;
    fontBody: string;
    imageDirection: string;
    openRouterApiKey: string;
    replicateApiToken: string;
    geoImportLimit: string;
    projectHomepagePrompt: string;
    projectServicePrompt: string;
    projectLocationPrompt: string;
    projectInternalLinkPrompt: string;
  };
  promptLibrary: PromptLibrary;
  workbookSummary: WorkbookSummary;
  mode: "create" | "edit";
  projectId?: string;
  currentStep?: StepId;
};

export function ProjectForm({ defaults, workbookSummary, mode, projectId, currentStep: initialStep, promptLibrary }: ProjectFormProps) {
  const formHandler =
    mode === "edit" && projectId ? updateProjectAction.bind(null, projectId) : saveProjectAction;
  const [state, formAction, isPending] = useActionState(formHandler, initialState);
  const [assistState, setAssistState] = useState<{ loading: AssistKind | null; message: string }>(
    { loading: null, message: "" }
  );
  const [geoState, setGeoState] = useState<{
    loading: boolean;
    message: string;
    snapshot: GeoTargetSnapshot | null;
  }>({ loading: false, message: "Choose a niche to load geo coverage.", snapshot: null });
  const router = useRouter();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState<StepId>(
    initialStep && isStepId(initialStep) ? initialStep : "basic"
  );
  
  // Form submission handler: only submit to server on Review step
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (currentStep !== "review") {
      e.preventDefault();
      return;
    }
    // Allow form submission on review step
  };
  const [siteName, setSiteName] = useState(defaults.siteName);
  const [brandName, setBrandName] = useState(defaults.brandName);
  const [primaryDomain, setPrimaryDomain] = useState(defaults.primaryDomain);
  const [mainNiche, setMainNiche] = useState(defaults.mainNiche);
  const [mainKeywordTargets, setMainKeywordTargets] = useState(defaults.mainKeywordTargets);
  const [microNicheKeywords, setMicroNicheKeywords] = useState(defaults.microNicheKeywords);
  const [tollFreeNumber, setTollFreeNumber] = useState(defaults.tollFreeNumber);
  const [campaignId, setCampaignId] = useState(defaults.campaignId);
  const [routingNotes, setRoutingNotes] = useState(defaults.routingNotes);
  const [templateFamily, setTemplateFamily] = useState(defaults.templateFamily);
  const [primaryColor, setPrimaryColor] = useState(defaults.primaryColor);
  const [accentColor, setAccentColor] = useState(defaults.accentColor);
  const [fontHeading, setFontHeading] = useState(defaults.fontHeading);
  const [fontBody, setFontBody] = useState(defaults.fontBody);
  const [imageDirection, setImageDirection] = useState(defaults.imageDirection);
  const [openRouterApiKey, setOpenRouterApiKey] = useState(defaults.openRouterApiKey);
  const [replicateApiToken, setReplicateApiToken] = useState(defaults.replicateApiToken);
  const [geoImportLimit, setGeoImportLimit] = useState(defaults.geoImportLimit);
  const [projectHomepagePrompt, setProjectHomepagePrompt] = useState(defaults.projectHomepagePrompt);
  const [projectServicePrompt, setProjectServicePrompt] = useState(defaults.projectServicePrompt);
  const [projectLocationPrompt, setProjectLocationPrompt] = useState(defaults.projectLocationPrompt);
  const [projectInternalLinkPrompt, setProjectInternalLinkPrompt] = useState(defaults.projectInternalLinkPrompt);
  const [importGeoTargets, setImportGeoTargets] = useState(true);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(mode !== "create");
  const lastAutoTemplate = useRef<string>(defaults.templateFamily);

  const currentIndex = wizardSteps.findIndex((step) => step.id === currentStep);
  const progress = Math.round(((currentIndex + 1) / wizardSteps.length) * 100);
  const activeStep = wizardSteps[currentIndex];

  const keywordSummary = splitCsv(mainKeywordTargets);
  const microNicheSummary = splitCsv(microNicheKeywords);
  const normalizedNiche = normalizeNiche(mainNiche);

  useEffect(() => {
    let isCancelled = false;

    async function loadGeoSnapshot() {
      if (!importGeoTargets || !normalizedNiche) {
        setGeoState({
          loading: false,
          message: importGeoTargets ? "Choose a niche to load geo coverage." : "Geo import is disabled for this project.",
          snapshot: null
        });
        setSelectedStates([]);
        return;
      }

      setGeoState((previous) => ({ ...previous, loading: true, message: "Loading geo coverage..." }));

      try {
        const limit = Math.max(Number(geoImportLimit) || 120, 1);
        const response = await fetch(`/api/geo-targets?niche=${encodeURIComponent(mainNiche)}&limit=${limit}`);
        const json = (await response.json()) as GeoTargetSnapshot & { error?: string };

        if (!response.ok) {
          throw new Error(json.error || "Unable to load geo targets.");
        }

        if (isCancelled) {
          return;
        }

        setGeoState({
          loading: false,
          message: `Loaded ${json.availableCount.toLocaleString()} geo targets across ${json.states.length} states.`,
          snapshot: json
        });
        setSelectedStates((previous) => {
          const allowedStates = new Set(json.states.map((entry) => entry.state));
          const retained = previous.filter((state) => allowedStates.has(state));
          if (retained.length > 0) {
            return retained;
          }
          return json.states.slice(0, Math.min(8, json.states.length)).map((entry) => entry.state);
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setGeoState({
          loading: false,
          message: error instanceof Error ? error.message : "Unable to load geo targets.",
          snapshot: null
        });
        setSelectedStates([]);
      }
    }

    void loadGeoSnapshot();

    return () => {
      isCancelled = true;
    };
  }, [geoImportLimit, importGeoTargets, mainNiche, normalizedNiche]);

  const filteredTargets = useMemo(() => {
    if (!geoState.snapshot || geoState.snapshot.targets.length === 0) {
      return [];
    }

    let targets = geoState.snapshot.targets;
    
    // Filter by selected states if any are chosen
    if (selectedStates.length > 0) {
      const stateSet = new Set(selectedStates.map((s) => s.toUpperCase().trim()));
      targets = targets.filter((target) => stateSet.has(target.state.toUpperCase()));
    }

    // Apply geo import limit
    const desiredLimit = Number(geoImportLimit);
    if (Number.isFinite(desiredLimit) && desiredLimit > 0) {
      return targets.slice(0, desiredLimit);
    }

    return targets;
  }, [geoImportLimit, geoState.snapshot, selectedStates]);

  useEffect(() => {
    if (mode !== "create" || typeof window === "undefined") {
      return;
    }

    const savedDraft = window.localStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
    if (!savedDraft) {
      setDraftReady(true);
      return;
    }

    try {
      const draft = JSON.parse(savedDraft) as Partial<Record<string, string | boolean | string[]>>;
      if (typeof draft.siteName === "string") setSiteName(draft.siteName);
      if (typeof draft.brandName === "string") setBrandName(draft.brandName);
      if (typeof draft.primaryDomain === "string") setPrimaryDomain(draft.primaryDomain);
      if (typeof draft.mainNiche === "string") setMainNiche(draft.mainNiche);
      if (typeof draft.mainKeywordTargets === "string") setMainKeywordTargets(draft.mainKeywordTargets);
      if (typeof draft.microNicheKeywords === "string") setMicroNicheKeywords(draft.microNicheKeywords);
      if (typeof draft.tollFreeNumber === "string") setTollFreeNumber(draft.tollFreeNumber);
      if (typeof draft.campaignId === "string") setCampaignId(draft.campaignId);
      if (typeof draft.routingNotes === "string") setRoutingNotes(draft.routingNotes);
      if (typeof draft.templateFamily === "string") {
        setTemplateFamily(draft.templateFamily);
        lastAutoTemplate.current = draft.templateFamily;
      }
      if (typeof draft.primaryColor === "string") setPrimaryColor(draft.primaryColor);
      if (typeof draft.accentColor === "string") setAccentColor(draft.accentColor);
      if (typeof draft.fontHeading === "string") setFontHeading(draft.fontHeading);
      if (typeof draft.fontBody === "string") setFontBody(draft.fontBody);
      if (typeof draft.imageDirection === "string") setImageDirection(draft.imageDirection);
      if (typeof draft.openRouterApiKey === "string") {
        setOpenRouterApiKey(
          draft.openRouterApiKey.trim() ? draft.openRouterApiKey : defaults.openRouterApiKey
        );
      }
      if (typeof draft.replicateApiToken === "string") {
        setReplicateApiToken(
          draft.replicateApiToken.trim() ? draft.replicateApiToken : defaults.replicateApiToken
        );
      }
      if (typeof draft.geoImportLimit === "string") setGeoImportLimit(draft.geoImportLimit);
      if (typeof draft.projectHomepagePrompt === "string") setProjectHomepagePrompt(draft.projectHomepagePrompt);
      if (typeof draft.projectServicePrompt === "string") setProjectServicePrompt(draft.projectServicePrompt);
      if (typeof draft.projectLocationPrompt === "string") setProjectLocationPrompt(draft.projectLocationPrompt);
      if (typeof draft.projectInternalLinkPrompt === "string") setProjectInternalLinkPrompt(draft.projectInternalLinkPrompt);
      if (typeof draft.importGeoTargets === "boolean") setImportGeoTargets(draft.importGeoTargets);
      if (Array.isArray(draft.selectedStates)) setSelectedStates(draft.selectedStates.filter(isString));
    } catch {
      window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
    } finally {
      setDraftReady(true);
    }
  }, [defaults.openRouterApiKey, defaults.replicateApiToken, mode]);

  useEffect(() => {
    if (mode !== "create" || typeof window === "undefined" || !draftReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      const draft = {
        siteName,
        brandName,
        primaryDomain,
        mainNiche,
        mainKeywordTargets,
        microNicheKeywords,
        tollFreeNumber,
        campaignId,
        routingNotes,
        templateFamily,
        primaryColor,
        accentColor,
        fontHeading,
        fontBody,
        imageDirection,
        openRouterApiKey,
        replicateApiToken,
        geoImportLimit,
        projectHomepagePrompt,
        projectServicePrompt,
        projectLocationPrompt,
        projectInternalLinkPrompt,
        importGeoTargets,
        selectedStates
      };

      window.localStorage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    mode,
    draftReady,
    siteName,
    brandName,
    primaryDomain,
    mainNiche,
    mainKeywordTargets,
    microNicheKeywords,
    tollFreeNumber,
    campaignId,
    routingNotes,
    templateFamily,
    primaryColor,
    accentColor,
    fontHeading,
    fontBody,
    imageDirection,
    openRouterApiKey,
    replicateApiToken,
    geoImportLimit,
    projectHomepagePrompt,
    projectServicePrompt,
    projectLocationPrompt,
    projectInternalLinkPrompt,
    importGeoTargets,
    selectedStates
  ]);

  useEffect(() => {
    if (!mainNiche.trim()) {
      return;
    }

    const suggested = inferDesignPreset(mainNiche);
    const shouldUpdateTemplate = !templateFamily || templateFamily === defaults.templateFamily || templateFamily === lastAutoTemplate.current;
    if (shouldUpdateTemplate) {
      setTemplateFamily(suggested.templateFamily);
      lastAutoTemplate.current = suggested.templateFamily;
    }
    if (!primaryColor || primaryColor === defaults.primaryColor) {
      setPrimaryColor(suggested.primaryColor);
    }
    if (!accentColor || accentColor === defaults.accentColor) {
      setAccentColor(suggested.accentColor);
    }
    if (!fontHeading || fontHeading === defaults.fontHeading) {
      setFontHeading(suggested.fontHeading);
    }
    if (!fontBody || fontBody === defaults.fontBody) {
      setFontBody(suggested.fontBody);
    }
    if (!imageDirection || imageDirection === defaults.imageDirection) {
      setImageDirection(suggested.imageDirection);
    }
  }, [mainNiche, primaryColor, accentColor, fontHeading, fontBody, imageDirection, defaults.primaryColor, defaults.accentColor, defaults.fontHeading, defaults.fontBody, defaults.imageDirection]);

  useEffect(() => {
    if (state.status !== "success" || !state.projectId) {
      return;
    }

    if (mode === "create" && typeof window !== "undefined") {
      window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
      router.push(`/projects/${state.projectId}`);
    }
  }, [mode, router, state.projectId, state.status]);
  useEffect(() => {
    if (!initialStep || !isStepId(initialStep)) {
      return;
    }

    setCurrentStep(initialStep);
  }, [initialStep]);

  function goToStep(step: StepId) {
    setCurrentStep(step);
    router.replace(`${pathname.replace(/\/[^/]+$/, "")}/${step}`, { scroll: false });
  }
  const selectedStateCoverage = useMemo(() => {
    if (!geoState.snapshot) {
      return 0;
    }

    if (selectedStates.length === 0) {
      return geoState.snapshot.availableCount;
    }

    const selectedSet = new Set(selectedStates);
    return geoState.snapshot.states
      .filter((entry) => selectedSet.has(entry.state))
      .reduce((sum, entry) => sum + entry.targetCount, 0);
  }, [geoState.snapshot, selectedStates]);

  async function runAssist(kind: AssistKind) {
    try {
      setAssistState({ loading: kind, message: "Generating suggestion..." });
      const response = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          niche: mainNiche,
          siteName,
          brandName,
          keywordTargets: keywordSummary,
          microNiches: microNicheSummary,
          imageDirection,
          apiKey: openRouterApiKey
        })
      });

      const json = (await response.json()) as {
        source?: "ai" | "fallback";
        data?: Record<string, unknown>;
        note?: string;
      };

      if (!response.ok || !json.data) {
        throw new Error(json.note || "Unable to generate suggestion.");
      }

      applyAssistResult(kind, json.data);
      setAssistState({
        loading: null,
        message:
          json.source === "ai"
            ? "AI suggestion applied."
            : json.note
              ? `Fallback suggestion applied. ${json.note}`
              : "Fallback suggestion applied."
      });
    } catch (error) {
      setAssistState({
        loading: null,
        message: error instanceof Error ? error.message : "Suggestion failed."
      });
    }
  }

  function applyAssistResult(kind: AssistKind, data: Record<string, unknown>) {
    if (kind === "basic") {
      if (typeof data.siteName === "string") setSiteName(data.siteName);
      if (typeof data.brandName === "string") setBrandName(data.brandName);
      return;
    }
    if (kind === "keywords") {
      if (Array.isArray(data.keywords)) {
        setMainKeywordTargets(data.keywords.filter(isString).join(", "));
      }
      return;
    }
    if (kind === "services") {
      if (Array.isArray(data.services)) {
        setMicroNicheKeywords(data.services.filter(isString).join(", "));
      }
      return;
    }
    if (typeof data.templateFamily === "string") setTemplateFamily(data.templateFamily);
    if (typeof data.primaryColor === "string") setPrimaryColor(data.primaryColor);
    if (typeof data.accentColor === "string") setAccentColor(data.accentColor);
    if (typeof data.imageDirection === "string") setImageDirection(data.imageDirection);
  }

  function toggleStateSelection(stateCode: string) {
    setSelectedStates((previous) =>
      previous.includes(stateCode)
        ? previous.filter((entry) => entry !== stateCode)
        : [...previous, stateCode]
    );
  }

  function selectTopStates() {
    if (!geoState.snapshot) {
      return;
    }
    setSelectedStates(geoState.snapshot.states.slice(0, Math.min(8, geoState.snapshot.states.length)).map((entry) => entry.state));
  }

  function selectAllStates() {
    if (!geoState.snapshot) {
      return;
    }
    setSelectedStates(geoState.snapshot.states.map((entry) => entry.state));
  }

  function clearStates() {
    setSelectedStates([]);
  }

  return (
    <form className="wizard-card" action={formAction} onSubmit={handleFormSubmit}>
      <HiddenField name="siteName" value={siteName} />
      <HiddenField name="brandName" value={brandName} />
      <HiddenField name="primaryDomain" value={primaryDomain} />
      <HiddenField name="mainNiche" value={mainNiche} />
      <HiddenField name="mainKeywordTargets" value={mainKeywordTargets} />
      <HiddenField name="microNicheKeywords" value={microNicheKeywords} />
      <HiddenField name="tollFreeNumber" value={tollFreeNumber} />
      <HiddenField name="campaignId" value={campaignId} />
      <HiddenField name="routingNotes" value={routingNotes} />
      <HiddenField name="templateFamily" value={templateFamily} />
      <HiddenField name="primaryColor" value={primaryColor} />
      <HiddenField name="accentColor" value={accentColor} />
      <HiddenField name="fontHeading" value={fontHeading} />
      <HiddenField name="fontBody" value={fontBody} />
      <HiddenField name="imageDirection" value={imageDirection} />
      <HiddenField name="openRouterApiKey" value={openRouterApiKey} />
      <HiddenField name="replicateApiToken" value={replicateApiToken} />
      <HiddenField name="geoImportLimit" value={geoImportLimit} />
      <HiddenField name="projectHomepagePrompt" value={projectHomepagePrompt} />
      <HiddenField name="projectServicePrompt" value={projectServicePrompt} />
      <HiddenField name="projectLocationPrompt" value={projectLocationPrompt} />
      <HiddenField name="projectInternalLinkPrompt" value={projectInternalLinkPrompt} />
      <HiddenField name="importGeoTargets" value={importGeoTargets ? "on" : "off"} />
      <HiddenField name="selectedStates" value={selectedStates.join(",")}></HiddenField>

      <header className="wizard-header">
        <div>
          <p className="section-kicker">Website creation wizard</p>
          <h2>{activeStep.title}</h2>
          <p className="muted">{activeStep.description}</p>
        </div>
        <div className="wizard-progress-wrap">
          <div className="wizard-progress-meta">
            <span>Step {currentIndex + 1} of {wizardSteps.length}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="wizard-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="wizard-step-tabs">
        {wizardSteps.map((step, index) => (
          <button
            className={step.id === currentStep ? "step-tab active" : "step-tab"}
            key={step.id}
            onClick={() => goToStep(step.id)}
            type="button"
          >
            <small>0{index + 1}</small>
            <span>{step.label}</span>
          </button>
        ))}
      </div>

      <div className="wizard-section-grid">
        {currentStep === "basic" ? (
          <section className="wizard-panel stack">
            <div className="split-fields">
              <Field label="Site name" placeholder="National Plumbing Connect" value={siteName} onValueChange={setSiteName} />
              <Field label="Brand name" placeholder="Plumbing Connect" value={brandName} onValueChange={setBrandName} />
            </div>
            <div className="split-fields">
              <Field label="Primary domain" placeholder="nationalplumbingconnect.com" value={primaryDomain} onValueChange={setPrimaryDomain} />
              <Field label="Ringba number" placeholder="833-555-0110" value={tollFreeNumber} onValueChange={setTollFreeNumber} />
            </div>
            <div className="split-fields">
              <Field label="Ringba campaign ID" placeholder="campaign-01" value={campaignId} onValueChange={setCampaignId} />
            </div>
            <TextAreaField label="Routing notes" placeholder="Manual routing notes and buyer coverage guidance" value={routingNotes} onValueChange={setRoutingNotes} />
            <ActionCard title="AI naming assist" description="Generate naming options from the niche and current brand direction." actionLabel="Suggest starter name" isLoading={assistState.loading === "basic"} onAction={() => runAssist("basic")} />
          </section>
        ) : null}

        {currentStep === "seo" ? (
          <section className="wizard-panel stack">
            <Field label="Main niche" placeholder="Plumbing" value={mainNiche} list="niche-options" onValueChange={setMainNiche} />
            <datalist id="niche-options">
              {workbookSummary.niches.map((niche) => (
                <option key={niche.sheetName} value={toDisplayNiche(niche.sheetName)} />
              ))}
            </datalist>
            <Field label="Main keyword targets" placeholder="plumber, emergency plumber, plumbing services" value={mainKeywordTargets} onValueChange={setMainKeywordTargets} />
            <ActionCard title="AI keyword direction" description="Use OpenRouter to suggest a people-first keyword set aligned with the niche." actionLabel="Suggest keyword set" isLoading={assistState.loading === "keywords"} onAction={() => runAssist("keywords")} />
            <article className="wizard-tip-card">
              <h3>Current keyword set</h3>
              <div className="pill-row">
                {keywordSummary.length > 0 ? keywordSummary.map((keyword) => <span className="pill" key={keyword}>{keyword}</span>) : <span className="pill">No primary keywords yet</span>}
              </div>
            </article>
          </section>
        ) : null}

        {currentStep === "services" ? (
          <section className="wizard-panel stack">
            <Field label="Micro-niche keywords" placeholder="drain cleaning, leak detection, water heater repair" value={microNicheKeywords} onValueChange={setMicroNicheKeywords} />
            <ActionCard title="AI service suggestions" description="Generate a stronger service cluster around the current niche." actionLabel="Generate service set" isLoading={assistState.loading === "services"} onAction={() => runAssist("services")} />
            <article className="wizard-tip-card">
              <h3>Service cluster preview</h3>
              <div className="pill-row">
                {microNicheSummary.length > 0 ? microNicheSummary.map((service) => <span className="pill" key={service}>{service}</span>) : <span className="pill">No service modules yet</span>}
              </div>
            </article>
          </section>
        ) : null}

        {currentStep === "geo" ? (
          <section className="wizard-panel stack">
            <div className="card inset-card no-shadow stack">
              <div className="section-header compact-header">
                <div>
                  <h3>Launch coverage workspace</h3>
                  <p className="muted">Use the payout workbook to choose the first states and cities this niche should launch with.</p>
                </div>
                <span className="pill">{geoState.snapshot?.availableCount.toLocaleString() ?? 0} targets</span>
              </div>
              <div className="split-fields geo-controls">
                <CheckboxField label="Import geo targets for this niche" checked={importGeoTargets} onToggle={setImportGeoTargets} />
                <Field label="Geo import limit" placeholder="200" value={geoImportLimit} onValueChange={setGeoImportLimit} />
              </div>
              <div className="geo-toolbar">
                <span className="status">{geoState.loading ? "Loading geo coverage..." : geoState.message}</span>
                <div className="actions">
                  <button className="button secondary small" onClick={selectTopStates} type="button">Top launch states</button>
                  <button className="button secondary small" onClick={selectAllStates} type="button">Select all</button>
                  <button className="button secondary small" onClick={clearStates} type="button">Clear</button>
                </div>
              </div>
              <GeoStateSelector
                selectedStates={selectedStates}
                snapshot={geoState.snapshot}
                onToggle={toggleStateSelection}
              />
              <article className="wizard-tip-card geo-summary-card">
                <div>
                  <h3>Selected launch footprint</h3>
                  <p className="muted">{selectedStates.length > 0 ? `${selectedStates.length} states selected.` : "No state filters selected yet. Use the launch state cards above."}</p>
                </div>
                <div className="pill-row">
                  <span className="pill">Coverage pool: {selectedStateCoverage.toLocaleString()}</span>
                  <span className="pill">Previewing: {filteredTargets.length.toLocaleString()}</span>
                </div>
              </article>
              <GeoTargetTable targets={filteredTargets.slice(0, 12)} />
            </div>
          </section>
        ) : null}

        {currentStep === "design" ? (
          <section className="wizard-panel stack">
            <div className="split-fields">
              <Field label="Template family" placeholder="emergency-home-service" value={templateFamily} onValueChange={setTemplateFamily} />
              <Field label="Heading font" placeholder="Space Grotesk" value={fontHeading} onValueChange={setFontHeading} />
            </div>
            <div className="split-fields">
              <Field label="Body font" placeholder="Source Sans 3" value={fontBody} onValueChange={setFontBody} />
              <Field label="Primary color" placeholder="#0f766e" value={primaryColor} onValueChange={setPrimaryColor} />
            </div>
            <div className="split-fields">
              <Field label="Accent color" placeholder="#f97316" value={accentColor} onValueChange={setAccentColor} />
            </div>
            <TextAreaField label="Image direction" placeholder="Describe the niche image style and trust signals" value={imageDirection} onValueChange={setImageDirection} />
            <ActionCard title="AI design assist" description="Use the niche to suggest a more distinctive template family, palette, and image direction." actionLabel="Suggest visual system" isLoading={assistState.loading === "design"} onAction={() => runAssist("design")} />
          </section>
        ) : null}

        {currentStep === "ai" ? (
          <section className="wizard-panel stack">
            <div className="split-fields">
              <Field label="OpenRouter API key" type="password" placeholder="Stored in studio for editable provider settings" value={openRouterApiKey} onValueChange={setOpenRouterApiKey} />
              <Field label="Replicate API token" type="password" placeholder="Stored in studio for editable provider settings" value={replicateApiToken} onValueChange={setReplicateApiToken} />
            </div>
            <article className="wizard-tip-card">
              <h3>Provider status</h3>
              <p className="muted">If no OpenRouter key is set, the assist buttons use safe local fallbacks so the wizard still works.</p>
            </article>
            <article className="wizard-tip-card">
              <div className="section-header compact-header">
                <div>
                  <h3>Active prompt library</h3>
                  <p className="muted">These saved studio prompts guide homepage, service, location, and internal-link generation unless you set project overrides below.</p>
                </div>
                <Link className="button secondary" href="/prompts">Edit studio prompts</Link>
              </div>
              <div className="prompt-preview-grid">
                <PromptPreviewCard title="Homepage prompt" value={promptLibrary.homepagePrompt} />
                <PromptPreviewCard title="Service page prompt" value={promptLibrary.servicePrompt} />
                <PromptPreviewCard title="Location page prompt" value={promptLibrary.locationPrompt} />
                <PromptPreviewCard title="Internal-link prompt" value={promptLibrary.internalLinkPrompt} />
              </div>
            </article>
            <article className="wizard-tip-card">
              <div className="section-header compact-header">
                <div>
                  <h3>Project prompt overrides</h3>
                  <p className="muted">Leave any field blank to inherit the studio default. Fill a field only when this niche needs a custom generation rule.</p>
                </div>
              </div>
              <div className="stack">
                <TextAreaField label="Homepage override" placeholder="Optional project-specific homepage prompt" value={projectHomepagePrompt} onValueChange={setProjectHomepagePrompt} />
                <TextAreaField label="Service page override" placeholder="Optional project-specific service prompt" value={projectServicePrompt} onValueChange={setProjectServicePrompt} />
                <TextAreaField label="Location page override" placeholder="Optional project-specific location prompt" value={projectLocationPrompt} onValueChange={setProjectLocationPrompt} />
                <TextAreaField label="Internal-link override" placeholder="Optional project-specific internal linking prompt" value={projectInternalLinkPrompt} onValueChange={setProjectInternalLinkPrompt} />
              </div>
            </article>
          </section>
        ) : null}

        {currentStep === "review" ? (
          <section className="wizard-panel stack">
            <article className="review-grid">
              <div>
                <h3>Basic information</h3>
                <p className="muted">{brandName || "Brand name pending"}</p>
                <p className="muted">{siteName || "Site name pending"}</p>
                <p className="muted">Ringba: {tollFreeNumber || "Not set"}</p>
              </div>
              <div>
                <h3>SEO and services</h3>
                <p className="muted">Main niche: {mainNiche || "Not selected"}</p>
                <p className="muted">Primary keywords: {keywordSummary.length}</p>
                <p className="muted">Micro-niches: {microNicheSummary.length}</p>
              </div>
              <div>
                <h3>Geo coverage</h3>
                <p className="muted">Workbook import: {importGeoTargets ? "Enabled" : "Disabled"}</p>
                <p className="muted">Selected states: {selectedStates.length}</p>
                <p className="muted">Planned geo targets: {filteredTargets.length.toLocaleString()}</p>
              </div>
              <div>
                <h3>Design and AI</h3>
                <p className="muted">Template: {templateFamily || "Pending"}</p>
                <p className="muted">Colors: {primaryColor} / {accentColor}</p>
                <p className="muted">Providers stored: {openRouterApiKey ? "OpenRouter" : "No key"}{replicateApiToken ? " + Replicate" : ""}</p>
                <p className="muted">Prompt library attached with {countOverrides([projectHomepagePrompt, projectServicePrompt, projectLocationPrompt, projectInternalLinkPrompt])} project overrides</p>
              </div>
            </article>
          </section>
        ) : null}
      </div>

      <footer className="wizard-footer">
        <button className="button secondary" disabled={currentIndex === 0} onClick={() => goToStep(wizardSteps[Math.max(currentIndex - 1, 0)].id)} type="button">
          Previous
        </button>
        <div className="wizard-footer-actions">
          <span aria-live="polite" className={state.status === "error" ? "status error" : "status"}>
            {assistState.message || state.message || "Progressively defining the site system before final save."}
          </span>
          {currentStep === "review" ? (
            <button className="button primary" disabled={isPending} type="submit">
              {isPending ? (mode === "edit" ? "Updating..." : "Saving...") : (mode === "edit" ? "Update project" : "Save project")}
            </button>
          ) : (
            <button className="button primary" onClick={() => goToStep(wizardSteps[Math.min(currentIndex + 1, wizardSteps.length - 1)].id)} type="button">
              Next step
            </button>
          )}
        </div>
      </footer>
    </form>
  );
}

function ActionCard({ title, description, actionLabel, isLoading, onAction }: { title: string; description: string; actionLabel: string; isLoading: boolean; onAction: () => void; }) {
  return (
    <article className="action-card">
      <div>
        <h3>{title}</h3>
        <p className="muted">{description}</p>
      </div>
      <button className="button secondary" disabled={isLoading} onClick={onAction} type="button">
        {isLoading ? "Working..." : actionLabel}
      </button>
    </article>
  );
}

function HiddenField({ name, value }: { name: string; value: string }) {
  return <input name={name} type="hidden" value={value} readOnly />;
}

function Field({ label, value, placeholder, type = "text", list, onValueChange }: { label: string; value: string; placeholder: string; type?: "text" | "password"; list?: string; onValueChange: (value: string) => void; }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} list={list} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} type={type} />
    </div>
  );
}

function TextAreaField({ label, value, placeholder, onValueChange }: { label: string; value: string; placeholder: string; onValueChange: (value: string) => void; }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function CheckboxField({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (value: boolean) => void; }) {
  return (
    <label className="check-field">
      <input checked={checked} onChange={(event) => onToggle(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function GeoStateSelector({ snapshot, selectedStates, onToggle }: { snapshot: GeoTargetSnapshot | null; selectedStates: string[]; onToggle: (stateCode: string) => void; }) {
  if (!snapshot) {
    return <p className="muted">No geo coverage available for the current niche yet.</p>;
  }

  return (
    <div className="state-grid">
      {snapshot.states.map((entry) => {
        const active = selectedStates.includes(entry.state);
        return (
          <button className={active ? "state-card active" : "state-card"} key={entry.state} onClick={() => onToggle(entry.state)} type="button">
            <div className="state-card-row">
              <strong>{entry.state}</strong>
              <span>{entry.targetCount.toLocaleString()}</span>
            </div>
            <p>{entry.sampleCities.join(", ") || "No sample cities"}</p>
            <small>{entry.topPayoutType || "Mixed payouts"} · Avg. priority {Math.round(entry.averagePriorityScore)}</small>
          </button>
        );
      })}
    </div>
  );
}

function GeoTargetTable({ targets }: { targets: GeoTargetSnapshot["targets"] }) {
  if (targets.length === 0) {
    return <p className="muted">Choose at least one state to preview launch targets.</p>;
  }

  return (
    <div className="table-shell compact-shell">
      <table className="geo-table">
        <thead>
          <tr>
            <th>Location</th>
            <th>ZIP</th>
            <th>Payout</th>
            <th>Priority</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((target) => (
            <tr key={`${target.state}-${target.city}-${target.zip}-${target.payoutType}`}>
              <td>
                <strong>{target.city}, {target.state}</strong>
                <div className="table-subtext">{target.county || "County unavailable"}</div>
              </td>
              <td>{target.zip}</td>
              <td>
                {target.payoutAmount ? `$${target.payoutAmount}` : "-"}
                <div className="table-subtext">{target.payoutType || "Mixed"}</div>
              </td>
              <td>{target.priorityScore}</td>
              <td>{target.dataConfidenceScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function splitCsv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeNiche(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function toDisplayNiche(value: string) {
  return value.toLowerCase().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}







function isStepId(value: string | null): value is StepId {
  return wizardSteps.some((step) => step.id === value);
}

function countOverrides(values: string[]) {
  return values.filter((value) => value.trim().length > 0).length;
}

function PromptPreviewCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="prompt-preview-card">
      <h4>{title}</h4>
      <p className="muted clamp-text">{value}</p>
    </article>
  );
}




function inferDesignPreset(niche: string) {
  const lookup = niche.toLowerCase().replace(/\s+/g, " ").trim();

  if (/(^|\\b)(plumb|plumber|plumbing)(\\b|$)/.test(lookup)) {
    return {
      templateFamily: "plumbing",
      primaryColor: "#0f766e",
      accentColor: "#f97316",
      fontHeading: "Poppins",
      fontBody: "Inter",
      imageDirection: "Professional plumbing teams, clean utility spaces, water-system repairs, homeowner reassurance, and bright service-trust photography."
    };
  }

  if (lookup.includes("hvac")) {
    return {
      templateFamily: "hvac",
      primaryColor: "#1d4ed8",
      accentColor: "#f59e0b",
      fontHeading: "Bebas Neue",
      fontBody: "Inter",
      imageDirection: "HVAC technicians in motion, equipment diagnostics, seasonal comfort scenes, and polished technical service imagery."
    };
  }

  if (lookup.includes("roof")) {
    return {
      templateFamily: "roofing",
      primaryColor: "#1f2937",
      accentColor: "#f97316",
      fontHeading: "Cormorant Garamond",
      fontBody: "Inter",
      imageDirection: "Roof crews, material textures, storm-repair visuals, exterior elevation shots, and high-trust project photography."
    };
  }

  if (lookup.includes("electrical")) {
    return {
      templateFamily: "electrical",
      primaryColor: "#1d4ed8",
      accentColor: "#facc15",
      fontHeading: "Plus Jakarta Sans",
      fontBody: "Source Sans 3",
      imageDirection: "Licensed electricians, panel work, lighting upgrades, and crisp safety-first technical imagery."
    };
  }

  if (lookup.includes("water damage")) {
    return {
      templateFamily: "water-damage",
      primaryColor: "#0f766e",
      accentColor: "#38bdf8",
      fontHeading: "Space Grotesk",
      fontBody: "Source Sans 3",
      imageDirection: "Restoration teams, moisture mitigation scenes, cleanup process shots, and urgent recovery visuals."
    };
  }

  if (lookup.includes("mold")) {
    return {
      templateFamily: "mold",
      primaryColor: "#14532d",
      accentColor: "#84cc16",
      fontHeading: "DM Sans",
      fontBody: "Inter",
      imageDirection: "Remediation crews, inspection details, containment setups, and clean indoor air quality visuals."
    };
  }

  if (lookup.includes("remodel")) {
    return {
      templateFamily: "premium-remodeling",
      primaryColor: "#1d4ed8",
      accentColor: "#f59e0b",
      fontHeading: "Cormorant Garamond",
      fontBody: "Inter",
      imageDirection: "Editorial renovation photography, material detail shots, elevated interiors, craftsmanship close-ups, and polished project reveals."
    };
  }

  if (lookup.includes("appliance")) {
    return {
      templateFamily: "technical-repair",
      primaryColor: "#dc2626",
      accentColor: "#f59e0b",
      fontHeading: "IBM Plex Sans",
      fontBody: "Public Sans",
      imageDirection: "In-home repair technicians, diagnostic close-ups, appliance restoration scenes, and clear technical trust visuals."
    };
  }

  return {
    templateFamily: "trust-heavy-leadgen",
    primaryColor: "#0f766e",
    accentColor: "#8e5dff",
    fontHeading: "Space Grotesk",
    fontBody: "Inter",
    imageDirection: "Clear local service imagery with trust cues, branded visuals, and people-first scenes tied to the niche."
  };
}








