export const dynamic = 'force-dynamic';
import Link from "next/link";
import { defaultProjectValues } from "@nls/shared";
import { ImportSummary } from "./import-summary";
import { StudioShell } from "./studio-shell";
import { listProjects } from "../lib/project-store";
import { getWorkbookSummary } from "../lib/workbook-import";

const workflowHighlights = [
  "Manual + AI-assisted inputs at every major step",
  "Nationwide niche structure with micro-niche support",
  "Workbook-backed geo targeting and review",
  "Reusable design families, prompts, and export settings"
];

export default async function HomePage() {
  const projects = await listProjects();
  const workbookSummary = await getWorkbookSummary();

  return (
    <StudioShell
      active="dashboard"
      title="Nationwide local-site generator"
      description="Manage your website systems, reopen saved projects, and launch new nationwide niche builds from one admin dashboard."
      stats={[
        { value: String(projects.length), label: "Saved projects" },
        { value: String(workbookSummary.niches.length), label: "Workbook niches" },
        { value: defaultProjectValues.brandTheme.templateFamily, label: "Default family", accent: true }
      ]}
    >
      <section className="content-grid">
        <div className="stack">
          <article className="card feature-card">
            <div className="section-header">
              <div>
                <p className="section-kicker">Builder focus</p>
                <h2>Admin dashboard</h2>
              </div>
            </div>
            <div className="highlight-grid">
              {workflowHighlights.map((item) => (
                <div className="highlight-pill" key={item}>
                  {item}
                </div>
              ))}
            </div>
            <div className="actions top-actions">
              <Link className="button primary" href="/create/basic">Start new website</Link>
              <Link className="button secondary" href="/websites">Open my websites</Link>
            </div>
          </article>

          <article className="card saved-projects-card">
            <div className="section-header">
              <div>
                <p className="section-kicker">Recent projects</p>
                <h2>Saved website systems</h2>
              </div>
              <span className="pill">SQLite local</span>
            </div>
            {projects.length === 0 ? (
              <p className="muted">No projects saved yet. Start a new website from the action above.</p>
            ) : (
              <div className="stack">
                {projects.slice(0, 5).map((project) => (
                  <Link className="card project-link-card" href={`/projects/${project.id}`} key={project.id}>
                    <div className="project-row">
                      <div>
                        <h3>{project.siteName}</h3>
                        <p className="muted">{project.brandName} · {project.mainNiche}</p>
                      </div>
                      <span className="pill">{project.stateCount} states</span>
                    </div>
                    <div className="pill-row compact-row">
                      <span className="pill">Geo targets: {project.geoTargetCount.toLocaleString()}</span>
                    </div>
                    {project.sampleLocations.length > 0 ? (
                      <p className="muted">{project.sampleLocations.join(" | ")}</p>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </article>

          <ImportSummary />
        </div>

        <article className="card dashboard-side-card">
          <p className="section-kicker">Quick start</p>
          <h2>Use the admin flow</h2>
          <p className="muted">The main domain now stays on the dashboard. The website builder lives under the create flow, and saved sites live under My Websites for edit and export.</p>
          <div className="stack compact-stack top-actions">
            <Link className="button primary" href="/create/basic">Go to create flow</Link>
            <Link className="button secondary" href="/deployments">Check exports</Link>
            <Link className="button secondary" href="/settings">Open AI settings</Link>
          </div>
        </article>
      </section>
    </StudioShell>
  );
}

