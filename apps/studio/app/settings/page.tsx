import { getStudioSettings } from "../../lib/project-store";
import { getWorkbookSummary } from "../../lib/workbook-import";
import { StudioShell } from "../studio-shell";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const workbookSummary = await getWorkbookSummary();

  const settings = await getStudioSettings();


  return (
    <StudioShell
      active="settings"
      title="AI settings"
      description="Manage the admin-wide provider keys and model defaults that feed the builder, prompt systems, and future generation flows."
      stats={[
        { value: String(workbookSummary.niches.length), label: "Workbook niches" },
        { value: settings.openRouterApiKey ? "Connected" : "Missing", label: "OpenRouter" },
        { value: settings.replicateApiToken ? "Connected" : "Missing", label: "Replicate", accent: true }
      ]}
    >
      <section className="content-grid single-main">
        <SettingsForm settings={settings} />
      </section>
    </StudioShell>
  );
}

