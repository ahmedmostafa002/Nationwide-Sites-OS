import Link from "next/link";
import { exportProjectFormAction } from "../actions";
import { StudioShell } from "../studio-shell";
import { listProjects } from "../../lib/project-store";

export default function WebsitesPage() {
  const projects = listProjects();
  const readyProjects = projects.filter((project) => project.healthStatus === "ready");
  const needsAttention = projects.length - readyProjects.length;

  return (
    <StudioShell
      active="websites"
      title="My websites"
      description="Manage saved site systems, check project readiness, and reopen any build for edits or fresh exports."
      stats={[
        { value: String(projects.length), label: "Projects" },
        { value: String(readyProjects.length), label: "Ready" },
        { value: String(needsAttention), label: "Needs attention", accent: true }
      ]}
    >
      <section className="stack">
        <div className="dashboard-strip three-up">
          <article className="card metric-card">
            <p className="section-kicker">Portfolio</p>
            <h2>{projects.length}</h2>
            <p className="muted">Saved nationwide site systems in the studio.</p>
          </article>
          <article className="card metric-card">
            <p className="section-kicker">Ready to work</p>
            <h2>{readyProjects.length}</h2>
            <p className="muted">Projects with domain, keywords, and geo coverage already in place.</p>
          </article>
          <article className="card metric-card accent-panel">
            <p className="section-kicker">Needs review</p>
            <h2>{needsAttention}</h2>
            <p className="muted">Projects missing core launch inputs so you can prioritize fixes quickly.</p>
          </article>
        </div>

        <article className="card management-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Project library</p>
              <h2>Website operations</h2>
              <p className="muted">Use this tab as the operating layer for saved sites, not just a list of records.</p>
            </div>
            <Link className="button primary" href="/create/basic">Create new website</Link>
          </div>
          {projects.length === 0 ? (
            <p className="muted">No saved websites yet. Create one first, then it will appear here for editing and export.</p>
          ) : (
            <div className="project-table project-health-table">
              <div className="project-table-head">
                <span>Website</span>
                <span>Readiness</span>
                <span>Content</span>
                <span>Coverage</span>
                <span>Actions</span>
              </div>
              {projects.map((project) => (
                <article className="project-table-row" key={project.id}>
                  <div>
                    <strong>{project.siteName}</strong>
                    <p className="muted">{project.brandName}</p>
                    <p className="muted clamp-line">{project.primaryDomain || "No primary domain set"}</p>
                  </div>
                  <div>
                    <span className={project.healthStatus === "ready" ? "pill success-pill" : "pill warning-pill"}>
                      {project.healthStatus === "ready" ? "Ready" : "Needs attention"}
                    </span>
                    <p className="muted top-gap-sm">{project.mainNiche}</p>
                    <p className="muted">{project.hasProviders ? "AI providers attached" : "No AI provider on project"}</p>
                  </div>
                  <div>
                    <strong>{project.keywordCount} main keywords</strong>
                    <p className="muted">{project.microNicheCount} micro-niches</p>
                    <p className="muted clamp-line">{project.sampleLocations.join(" | ") || "No sample markets yet"}</p>
                  </div>
                  <div>
                    <strong>{project.stateCount} states</strong>
                    <p className="muted">{project.geoTargetCount.toLocaleString()} geo targets</p>
                    <p className="muted">Updated {new Date(project.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="actions compact-actions vertical-actions">
                    <Link className="button secondary" href={`/projects/${project.id}`}>Review</Link>
                    <Link className="button secondary" href={`/projects/${project.id}/edit/basic`}>Edit</Link>
                    <form action={exportProjectFormAction.bind(null, project.id)} method="post">
                      <button className="button primary" type="submit">Export again</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </StudioShell>
  );
}
