"use client";

import { useActionState } from "react";
import { savePromptLibraryAction, type SaveProjectState } from "../actions";
import type { PromptLibrary } from "../../lib/project-store";

const initialState: SaveProjectState = {
  status: "idle",
  message: ""
};

export function PromptLibraryForm({ prompts }: { prompts: PromptLibrary }) {
  const [state, formAction, isPending] = useActionState(savePromptLibraryAction, initialState);

  return (
    <form action={formAction} className="settings-layout prompt-editor-layout">
      <section className="settings-main stack">
        <article className="card settings-card">
          <p className="section-kicker">Homepage system</p>
          <h3>Homepage prompt</h3>
          <p className="muted">Designed for people-first homepage content with trust, service clarity, and anti-thin-page rules.</p>
          <div className="field">
            <textarea defaultValue={prompts.homepagePrompt} name="homepagePrompt" />
          </div>
        </article>

        <article className="card settings-card">
          <p className="section-kicker">Service system</p>
          <h3>Service page prompt</h3>
          <p className="muted">Focused on one clear service intent with useful explanations, FAQs, and strong quality thresholds.</p>
          <div className="field">
            <textarea defaultValue={prompts.servicePrompt} name="servicePrompt" />
          </div>
        </article>

        <article className="card settings-card">
          <p className="section-kicker">Location system</p>
          <h3>Location page prompt</h3>
          <p className="muted">Built to avoid doorway-style city pages and require genuine local usefulness before publishing.</p>
          <div className="field">
            <textarea defaultValue={prompts.locationPrompt} name="locationPrompt" />
          </div>
        </article>

        <article className="card settings-card">
          <p className="section-kicker">Internal linking</p>
          <h3>Anchor and link prompt</h3>
          <p className="muted">Encourages natural internal linking, mixed anchors, and user-first navigation paths.</p>
          <div className="field">
            <textarea defaultValue={prompts.internalLinkPrompt} name="internalLinkPrompt" />
          </div>
        </article>
      </section>

      <aside className="settings-side stack">
        <article className="card settings-side-card">
          <p className="section-kicker">Prompt status</p>
          <h3>Library readiness</h3>
          <div className="stack compact-stack">
            <div className="status-row"><span>Homepage</span><strong>Google-aligned</strong></div>
            <div className="status-row"><span>Service pages</span><strong>Google-aligned</strong></div>
            <div className="status-row"><span>Location pages</span><strong>Google-aligned</strong></div>
            <div className="status-row"><span>Internal links</span><strong>Google-aligned</strong></div>
          </div>
        </article>

        <article className="card settings-side-card">
          <p className="section-kicker">Save</p>
          <h3>Update prompt library</h3>
          <p className={state.status === "error" ? "status error" : "status"}>
            {state.message || "These prompts become the default quality and content instructions across the studio."}
          </p>
          <button className="button primary settings-save" disabled={isPending} type="submit">
            {isPending ? "Saving prompts..." : "Save prompts"}
          </button>
        </article>
      </aside>
    </form>
  );
}
