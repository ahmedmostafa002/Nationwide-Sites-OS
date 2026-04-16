import Link from "next/link";
import { ProjectForm } from "../project-form";
import { StudioShell } from "../studio-shell";
import { getWorkbookSummary } from "../../lib/workbook-import";
import { createProjectDraft, getPromptLibrary, getStudioSettings, listExports, listProjects } from "../../lib/project-store";

type CreateStepId = "basic" | "seo" | "services" | "geo" | "design" | "ai" | "review";

const stepCopy: Record<CreateStepId, { title: string; description: string }> = {
  basic: {
    title: "Basic information",
    description: "Define the site record, niche identity, and manual Ringba setup."
  },
  seo: {
    title: "SEO focus",
    description: "Set the main niche and keyword direction for the project."
  },
  services: {
    title: "Services",
    description: "Map the services and micro-niches that will shape the site."
  },
  geo: {
    title: "Geo targeting",
    description: "Select the states and city targets this niche should launch with."
  },
  design: {
    title: "Design system",
    description: "Choose the design family, colors, typography, and image rules."
  },
  ai: {
    title: "AI and prompts",
    description: "Store provider keys and define the generation direction for this project."
  },
  review: {
    title: "Review",
    description: "Confirm the niche, geo, design, and AI settings before saving."
  }
};

export function CreateStepPage({ currentStep }: { currentStep: CreateStepId }) {
  const draft = createProjectDraft();
  const workbookSummary = getWorkbookSummary();
  const studioSettings = getStudioSettings();
  const promptLibrary = getPromptLibrary();
  const projects = listProjects();
  const exports = listExports();
  const copy = stepCopy[currentStep];

  return (
    <StudioShell
      active="create"
      title="Create website"
      description="Use the guided admin workflow to build a new nationwide niche website inside the main dashboard system."
      stats={[
        { value: copy.title, label: "Current step" },
        { value: String(workbookSummary.niches.length), label: "Workbook niches" }
      ]}
    >
      <section className="stack">
        <div className="workspace-switcher card">
          <div className="workspace-tabs">
            <Link className="workspace-tab" href="/">
              <small>Control center</small>
              <strong>Dashboard</strong>
            </Link>
            <div className="workspace-tab active">
              <small>Builder workspace</small>
              <strong>Create</strong>
            </div>
          </div>
          <div className="workspace-summary">
            <span className="pill">{projects.length} projects</span>
            <span className="pill">{exports.length} exports</span>
            <span className="pill">{workbookSummary.niches.length} niches</span>
          </div>
        </div>

        <section className="content-grid single-main">
          <ProjectForm
            defaults={{
              siteName: draft.siteName,
              brandName: draft.brandName,
              primaryDomain: draft.primaryDomain,
              mainNiche: draft.niche.mainNiche,
              mainKeywordTargets: draft.niche.mainKeywordTargets.join(", "),
              microNicheKeywords: draft.niche.microNicheKeywords.join(", "),
              tollFreeNumber: draft.ringba.tollFreeNumber,
              campaignId: draft.ringba.campaignId,
              routingNotes: draft.ringba.routingNotes,
              templateFamily: draft.brandTheme.templateFamily,
              primaryColor: draft.brandTheme.primaryColor,
              accentColor: draft.brandTheme.accentColor,
              fontHeading: draft.brandTheme.fontHeading,
              fontBody: draft.brandTheme.fontBody,
              imageDirection: draft.brandTheme.imageDirection,
              openRouterApiKey: studioSettings.openRouterApiKey || draft.providerSettings.openRouterApiKey,
              replicateApiToken: studioSettings.replicateApiToken || draft.providerSettings.replicateApiToken,
              geoImportLimit: "200",
              projectHomepagePrompt: draft.promptOverrides.homepagePrompt,
              projectServicePrompt: draft.promptOverrides.servicePrompt,
              projectLocationPrompt: draft.promptOverrides.locationPrompt,
              projectInternalLinkPrompt: draft.promptOverrides.internalLinkPrompt
            }}
            mode="create"
            workbookSummary={workbookSummary}
            currentStep={currentStep}
            promptLibrary={promptLibrary}
          />
        </section>
      </section>
    </StudioShell>
  );
}
