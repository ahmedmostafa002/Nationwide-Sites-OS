export const dynamic = 'force-dynamic';
import { StudioShell } from "../studio-shell";
import { getPromptLibrary } from "../../lib/project-store";
import { PromptLibraryForm } from "./prompt-library-form";

const guidelinePoints = [
  "People-first writing over keyword-stuffed SEO copy",
  "No doorway-style city pages or scaled thin content",
  "Unique page purpose and meaningful local/service value",
  "Structured data and visible page intent must match",
  "Internal links should help visitors, not manipulate rankings"
];

export default async function PromptsPage() {
  const prompts = await getPromptLibrary();

  return (
    <StudioShell
      active="prompts"
      title="Prompt systems"
      description="Manage the reusable prompt frameworks that guide homepage, service, geo, and internal-link generation across every build."
      stats={[
        { value: prompts.updatedAt ? "Saved" : "Default", label: "Library status" },
        { value: "Google-aligned", label: "Prompt policy", accent: true }
      ]}
    >
      <section className="stack">
        <div className="dashboard-strip two-up">
          <article className="card accent-panel">
            <p className="section-kicker">Prompt library</p>
            <h2>Structured generation layer</h2>
            <p className="muted">These prompts now start from helpful-content, anti-thin-page, and anti-doorway rules from your plan.</p>
          </article>
          <article className="card metric-card">
            <p className="section-kicker">Last update</p>
            <h2>{prompts.updatedAt ? new Date(prompts.updatedAt).toLocaleDateString() : "Default library"}</h2>
            <p className="muted">Adjust these prompts to change the default content behavior across the studio.</p>
          </article>
        </div>

        <article className="card management-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Quality policy</p>
              <h2>Google-aligned guardrails</h2>
            </div>
          </div>
          <div className="highlight-grid compact-highlight-grid">
            {guidelinePoints.map((item) => (
              <div className="highlight-pill" key={item}>{item}</div>
            ))}
          </div>
        </article>

        <PromptLibraryForm prompts={prompts} />
      </section>
    </StudioShell>
  );
}
