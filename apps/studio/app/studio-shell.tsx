import Link from "next/link";
import { listExports, listProjects, getStudioSettings } from "../lib/project-store";
import { getWorkbookSummary } from "../lib/workbook-import";

const navigationItems = [
  { label: "Dashboard", href: "/", key: "dashboard" },
  { label: "Create", href: "/create/basic", key: "create" },
  { label: "Websites", href: "/websites", key: "websites" },
  { label: "Prompts", href: "/prompts", key: "prompts" },
  { label: "AI Settings", href: "/settings", key: "settings" },
  { label: "Deployments", href: "/deployments", key: "deployments" }
] as const;

export function StudioShell({
  active,
  title,
  description,
  stats,
  children
}: {
  active: (typeof navigationItems)[number]["key"];
  title: string;
  description: string;
  stats?: Array<{ value: string; label: string; accent?: boolean }>;
  children: React.ReactNode;
}) {
  const projects = listProjects();
  const exports = listExports();
  const settings = getStudioSettings();
  const workbookSummary = getWorkbookSummary();
  const totalGeoTargets = projects.reduce((sum, project) => sum + project.geoTargetCount, 0);
  const connectedProviders = [settings.openRouterApiKey, settings.replicateApiToken].filter(Boolean).length;

  const analytics = [
    { label: "Projects", value: String(projects.length), tone: "default" },
    { label: "Targets", value: totalGeoTargets.toLocaleString(), tone: "default" },
    { label: "Exports", value: String(exports.length), tone: "default" },
    { label: "AI", value: `${connectedProviders}/2`, tone: connectedProviders === 2 ? "success" : "warning" }
  ] as const;

  const systemFeed = [
    `${workbookSummary.niches.length} niches loaded`,
    settings.openRouterApiKey ? "OpenRouter connected" : "OpenRouter missing",
    settings.replicateApiToken ? "Replicate connected" : "Replicate missing"
  ];

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <div className="brand-mark compact-brand">
          <span className="brand-icon">N</span>
          <div>
            <strong>Nationwide Sites OS</strong>
            <p>Local site factory</p>
          </div>
        </div>

        <article className="sidebar-analytics compact-analytics">
          <div className="sidebar-analytics-head compact-head">
            <div>
              <p className="section-kicker">Overview</p>
              <h3>Studio</h3>
            </div>
            <span className="pill compact-pill">Live</span>
          </div>
          <div className="analytics-grid compact-grid">
            {analytics.map((item) => (
              <div className={`analytics-card ${item.tone}`} key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="system-feed compact-feed">
            {systemFeed.map((item) => (
              <div className="system-feed-item" key={item}>{item}</div>
            ))}
          </div>
        </article>

        <div className="sidebar-section-label">Navigation</div>
        <nav className="sidebar-nav compact-nav">
          {navigationItems.map((item) => (
            <Link className={item.key === active ? "nav-item active" : "nav-item"} href={item.href} key={item.key}>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <article className="sidebar-card compact-rules">
          <div className="sidebar-section-label">Rules</div>
          <ul className="sidebar-list">
            <li>No thin pages</li>
            <li>Unique niche design</li>
            <li>AI after review</li>
          </ul>
        </article>
      </aside>

      <main className="studio-main compact-main">
        <section className="topbar hero-panel compact-hero">
          <div className="hero-copy compact-copy">
            <p className="section-kicker">Control Center</p>
            <h1>{title}</h1>
            <p className="muted max-copy">{description}</p>
          </div>
          <div className="hero-metrics compact-metrics">
            {stats && stats.length > 0 ? (
              stats.map((stat) => (
                <div className={stat.accent ? "stat-chip accent" : "stat-chip"} key={`${stat.label}-${stat.value}`}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))
            ) : (
              <>
                <div className="stat-chip">
                  <strong>{projects.length}</strong>
                  <span>Projects</span>
                </div>
                <div className="stat-chip">
                  <strong>{exports.length}</strong>
                  <span>Exports</span>
                </div>
              </>
            )}
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
