import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProjectForm } from "../../../../project-form";
import { StudioShell } from "../../../../studio-shell";
import { getProjectById, getPromptLibrary } from "../../../../../lib/project-store";
import { getWorkbookSummary } from "../../../../../lib/workbook-import";

export const dynamic = 'force-dynamic';

export default async function EditDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = getProjectById(id);
  const workbookSummary = getWorkbookSummary();
  const promptLibrary = getPromptLibrary();

  if (!project) {
    notFound();
  }

  return (
    <StudioShell
      active="websites"
      title={`Edit ${project.siteName}`}
      description="Update the saved niche, geo targeting, design system, and provider settings, then save or export again."
      stats={[
        { value: project.niche.mainNiche, label: "Main niche" },
        { value: String(project.geoTargets.length), label: "Geo targets" }
      ]}
    >
      <section className="content-grid single-main">
        <Suspense fallback={<div className="card"><p className="muted">Loading builder...</p></div>}>
          <ProjectForm
            defaults={{
              siteName: project.siteName,
              brandName: project.brandName,
              primaryDomain: project.primaryDomain,
              mainNiche: project.niche.mainNiche,
              mainKeywordTargets: project.niche.mainKeywordTargets.join(", "),
              microNicheKeywords: project.niche.microNicheKeywords.join(", "),
              tollFreeNumber: project.ringba.tollFreeNumber,
              campaignId: project.ringba.campaignId,
              routingNotes: project.ringba.routingNotes,
              templateFamily: project.brandTheme.templateFamily,
              primaryColor: project.brandTheme.primaryColor,
              accentColor: project.brandTheme.accentColor,
              fontHeading: project.brandTheme.fontHeading,
              fontBody: project.brandTheme.fontBody,
              imageDirection: project.brandTheme.imageDirection,
              openRouterApiKey: project.providerSettings.openRouterApiKey,
              replicateApiToken: project.providerSettings.replicateApiToken,
              geoImportLimit: String(Math.max(project.geoTargets.length, 200)),
              projectHomepagePrompt: project.promptOverrides.homepagePrompt,
              projectServicePrompt: project.promptOverrides.servicePrompt,
              projectLocationPrompt: project.promptOverrides.locationPrompt,
              projectInternalLinkPrompt: project.promptOverrides.internalLinkPrompt
            }}
            mode="edit"
            projectId={project.id}
            workbookSummary={workbookSummary}
            currentStep="design"
            promptLibrary={promptLibrary}
          />
        </Suspense>
      </section>
    </StudioShell>
  );
}