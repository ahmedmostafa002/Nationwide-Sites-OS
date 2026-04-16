"use client";

import { useActionState } from "react";
import { saveStudioSettingsAction, type SaveProjectState } from "../actions";
import type { StudioSettings } from "../../lib/project-store";

const initialState: SaveProjectState = {
  status: "idle",
  message: ""
};

export function SettingsForm({ settings }: { settings: StudioSettings }) {
  const [state, formAction, isPending] = useActionState(saveStudioSettingsAction, initialState);

  return (
    <form action={formAction} className="settings-layout">
      <section className="settings-main stack">
        <article className="card settings-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Provider vault</p>
              <h2>API connections</h2>
              <p className="muted">Store the admin-wide provider keys here so new projects can inherit them by default.</p>
            </div>
            <span className="pill">{settings.updatedAt ? "Saved" : "Not configured"}</span>
          </div>

          <div className="split-fields">
            <div className="field">
              <label htmlFor="openRouterApiKey">OpenRouter API key</label>
              <input defaultValue={settings.openRouterApiKey} id="openRouterApiKey" name="openRouterApiKey" placeholder="sk-or-v1-..." type="password" />
            </div>
            <div className="field">
              <label htmlFor="replicateApiToken">Replicate API token</label>
              <input defaultValue={settings.replicateApiToken} id="replicateApiToken" name="replicateApiToken" placeholder="r8_..." type="password" />
            </div>
          </div>
        </article>

        <article className="card settings-card">
          <div className="section-header">
            <div>
              <p className="section-kicker">Model defaults</p>
              <h2>Recommended starting models</h2>
              <p className="muted">These defaults help the studio suggest the right providers across create, prompts, and future generation flows.</p>
            </div>
          </div>

          <div className="split-fields">
            <div className="field">
              <label htmlFor="defaultTextModel">Default text model</label>
              <select defaultValue={settings.defaultTextModel} id="defaultTextModel" name="defaultTextModel" className="model-select">
                <option value="anthropic/claude-3.7-sonnet">Claude 3.7 Sonnet (Anthropic)</option>
                <option value="openrouter/auto">OpenRouter Auto</option>
                <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
                <option value="x-ai/grok-4-fast">Grok 4 Fast (xAI)</option>
                <option value="x-ai/grok-4">Grok 4 (xAI)</option>
                <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6 (Anthropic)</option>
                <option value="openai/gpt-5-mini">GPT-5 Mini (OpenAI)</option>
                <option value="openai/gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
              </select>
              <p className="muted">Build export uses the selected OpenRouter model when possible. Non-OpenRouter values fall back to <code>openrouter/auto</code> for page generation.</p>
            </div>
            <div className="field">
              <label htmlFor="defaultImageModel">Default image model</label>
              <select defaultValue={settings.defaultImageModel} id="defaultImageModel" name="defaultImageModel" className="model-select">
                <option value="minimax/image-01">Minimax Image 01</option>
                <option value="prunaai/p-image">Pruna AI P-Image</option>
                <option value="replicate/flux-schnell">Flux Schnell (Replicate)</option>
                <option value="replicate/stable-diffusion-xl">Stable Diffusion XL (Replicate)</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="workspaceNotes">Workspace notes</label>
            <textarea defaultValue={settings.workspaceNotes} id="workspaceNotes" name="workspaceNotes" placeholder="Notes about provider usage, fallback rules, and team guidance." />
          </div>
        </article>
      </section>

      <aside className="settings-side stack">
        <article className="card settings-side-card">
          <p className="section-kicker">Studio status</p>
          <h3>Saved provider defaults</h3>
          <div className="stack compact-stack">
            <div className="status-row">
              <span>OpenRouter</span>
              <strong>{settings.openRouterApiKey ? "Connected" : "Missing"}</strong>
            </div>
            <div className="status-row">
              <span>Replicate</span>
              <strong>{settings.replicateApiToken ? "Connected" : "Missing"}</strong>
            </div>
            <div className="status-row">
              <span>Text model</span>
              <strong>{settings.defaultTextModel}</strong>
            </div>
            <div className="status-row">
              <span>OpenRouter build model</span>
              <strong>{settings.defaultTextModel.startsWith("openrouter/") ? settings.defaultTextModel : "openrouter/auto"}</strong>
            </div>
            <div className="status-row">
              <span>Image model</span>
              <strong>{settings.defaultImageModel}</strong>
            </div>
          </div>
        </article>

        <article className="card settings-side-card">
          <p className="section-kicker">Save</p>
          <h3>Update the admin defaults</h3>
          <p className={state.status === "error" ? "status error" : "status"}>
            {state.message || "Builder pages can use these values as default provider settings."}
          </p>
          <button className="button primary settings-save" disabled={isPending} type="submit">
            {isPending ? "Saving settings..." : "Save AI settings"}
          </button>
        </article>
      </aside>
    </form>
  );
}

