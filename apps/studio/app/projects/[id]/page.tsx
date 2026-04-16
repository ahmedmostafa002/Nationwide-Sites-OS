import Link from "next/link";
import { notFound } from "next/navigation";
import { buildSiteManifest } from "@nls/shared";
import { exportProjectFormAction } from "../../actions";
import { StudioShell } from "../../studio-shell";
import { getProjectById } from "../../../lib/project-store";
import { GeoTargetReview } from "./geo-target-review";

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectById(id);


  if (!project) {
    notFound();
  }

  const manifest = buildSiteManifest(project);
  const readinessChecks = [
    { label: "Domain", ok: Boolean(project.primaryDomain) },
    { label: "Keywords", ok: project.niche.mainKeywordTargets.length > 0 },
    { label: "Geo", ok: project.geoTargets.length > 0 },
    {
      label: "AI Providers",
      ok: Boolean(project.providerSettings.openRouterApiKey || project.providerSettings.replicateApiToken)
    }
  ];

  return (
    <StudioShell
      active="websites"
      title={project.siteName}
      description="Review the current saved website system, inspect geo coverage, then reopen it for edits or export a fresh bundle."
      stats={[
        { value: project.niche.mainNiche, label: "Main niche" },
        { value: String(project.geoTargets.length), label: "Geo targets" },
        { value: project.brandTheme.templateFamily, label: "Template" }
      ]}
    >
      <section className="stack">
        <div className="dashboard-strip two-up">
          <article className="card metric-card">
            <p className="section-kicker">Project summary</p>
            <h2>{project.brandName}</h2>
            <p className="muted">{project.primaryDomain || "No primary domain set yet."}</p>
            <div className="pill-row top-actions">
              <span className="pill">Ringba: {project.ringba.tollFreeNumber}</span>
              <span className="pill">Updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
            </div>
          </article>
          <article className="card metric-card">
            <p className="section-kicker">Readiness</p>
            <h2>Launch checks</h2>
            <div className="stack compact-stack top-gap-sm">
              {readinessChecks.map((item) => (
                <div className="status-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.ok ? "Ready" : "Missing"}</strong>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="dashboard-strip two-up">
          <article className="card metric-card">
            <p className="section-kicker">Astro page plan</p>
            <h2>{manifest.counts.totalPages}</h2>
            <p className="muted">Structured pages ready for template rendering from this project export.</p>
            <div className="pill-row top-actions">
              <span className="pill">Services: {manifest.counts.servicePages}</span>
              <span className="pill">States: {manifest.counts.statePages}</span>
              <span className="pill">Cities: {manifest.counts.cityPages}</span>
              <span className="pill">City + service: {manifest.counts.cityServicePages}</span>
            </div>
          </article>
          <article className="card metric-card">
            <p className="section-kicker">Template bridge</p>
            <h2>{manifest.templateFamily}</h2>
            <p className="muted">The export now includes a full site manifest so Astro can render routes from saved project data.</p>
            <div className="pill-row top-actions">
              {manifest.serviceKeys.slice(0, 4).map((service) => (
                <span className="pill" key={service}>{service}</span>
              ))}
            </div>
          </article>
        </div>

        <article className="card management-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Controls</p>
              <h2>Project actions</h2>
            </div>
          </div>
          {project.niche.microNicheKeywords.length > 0 ? (
            <p className="muted">Micro-niches: {project.niche.microNicheKeywords.join(", ")}</p>
          ) : (
            <p className="muted">No micro-niches configured yet.</p>
          )}
          <div className="actions top-actions">
            <Link className="button secondary" href="/websites">Back to Websites</Link>
            <Link className="button secondary" href={`/projects/${project.id}/edit/basic`}>Edit website</Link>
            <form action={exportProjectFormAction.bind(null, project.id)} method="post">
              <button className="button primary" type="submit">Export again</button>
            </form>
          </div>
        </article>

        <GeoTargetReview project={project} />
      </section>
    </StudioShell>
  );
}
