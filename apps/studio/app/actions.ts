"use server";

import { revalidatePath } from "next/cache";
import { exportProjectBundle, saveProject, savePromptLibrary, saveStudioSettings, updateProject } from "../lib/project-store";

export type SaveProjectState = {
  status: "idle" | "success" | "error";
  message: string;
  projectId?: string;
};

export async function saveProjectAction(
  _prevState: SaveProjectState,
  formData: FormData
): Promise<SaveProjectState> {
  try {
    const project = saveProject(getProjectInput(formData));

    revalidatePath("/");
    revalidatePath("/websites");

    return {
      status: "success",
      message:
        project.geoTargets.length > 0
          ? `Project saved with ${project.geoTargets.length.toLocaleString()} geo targets.`
          : "Project saved to local studio storage.",
      projectId: project.id
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save the project."
    };
  }
}

export async function updateProjectAction(
  projectId: string,
  _prevState: SaveProjectState,
  formData: FormData
): Promise<SaveProjectState> {
  try {
    const project = updateProject(projectId, getProjectInput(formData));

    revalidatePath("/");
    revalidatePath("/websites");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/edit`);

    return {
      status: "success",
      message: `Project updated. ${project.geoTargets.length.toLocaleString()} geo targets are now attached.`,
      projectId: project.id
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to update the project."
    };
  }
}

export async function saveStudioSettingsAction(
  _prevState: SaveProjectState,
  formData: FormData
): Promise<SaveProjectState> {
  try {
    const settings = saveStudioSettings({
      openRouterApiKey: getValue(formData, "openRouterApiKey"),
      replicateApiToken: getValue(formData, "replicateApiToken"),
      defaultTextModel: getValue(formData, "defaultTextModel"),
      defaultImageModel: getValue(formData, "defaultImageModel"),
      workspaceNotes: getValue(formData, "workspaceNotes")
    });

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/create/basic");
    revalidatePath("/create/ai");

    return {
      status: "success",
      message: settings.updatedAt
        ? "Studio AI settings saved successfully."
        : "Studio AI settings updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save studio settings."
    };
  }
}

export async function savePromptLibraryAction(
  _prevState: SaveProjectState,
  formData: FormData
): Promise<SaveProjectState> {
  try {
    savePromptLibrary({
      homepagePrompt: getValue(formData, "homepagePrompt"),
      servicePrompt: getValue(formData, "servicePrompt"),
      locationPrompt: getValue(formData, "locationPrompt"),
      internalLinkPrompt: getValue(formData, "internalLinkPrompt")
    });

    revalidatePath("/prompts");
    return {
      status: "success",
      message: "Prompt library updated."
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to save prompt library."
    };
  }
}

export async function exportProjectAction(projectId: string): Promise<SaveProjectState> {
  try {
    const result = await exportProjectBundle(projectId);
    revalidatePath("/deployments");
    revalidatePath("/websites");
    return {
      status: "success",
      message: `Export created: ${result.fileName}`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to export the project."
    };
  }
}

function getProjectInput(formData: FormData) {
  return {
    siteName: getValue(formData, "siteName"),
    brandName: getValue(formData, "brandName"),
    primaryDomain: getValue(formData, "primaryDomain"),
    mainNiche: getValue(formData, "mainNiche"),
    mainKeywordTargets: getValue(formData, "mainKeywordTargets"),
    microNicheKeywords: getValue(formData, "microNicheKeywords"),
    tollFreeNumber: getValue(formData, "tollFreeNumber"),
    campaignId: getValue(formData, "campaignId"),
    routingNotes: getValue(formData, "routingNotes"),
    templateFamily: getValue(formData, "templateFamily"),
    primaryColor: getValue(formData, "primaryColor"),
    accentColor: getValue(formData, "accentColor"),
    fontHeading: getValue(formData, "fontHeading"),
    fontBody: getValue(formData, "fontBody"),
    imageDirection: getValue(formData, "imageDirection"),
    openRouterApiKey: getValue(formData, "openRouterApiKey"),
    replicateApiToken: getValue(formData, "replicateApiToken"),
    projectHomepagePrompt: getValue(formData, "projectHomepagePrompt"),
    projectServicePrompt: getValue(formData, "projectServicePrompt"),
    projectLocationPrompt: getValue(formData, "projectLocationPrompt"),
    projectInternalLinkPrompt: getValue(formData, "projectInternalLinkPrompt"),
    importGeoTargets: getValue(formData, "importGeoTargets"),
    geoImportLimit: getValue(formData, "geoImportLimit"),
    selectedStates: getValue(formData, "selectedStates")
  };
}

function getValue(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value : "";
}

export async function exportProjectFormAction(projectId: string, _formData: FormData): Promise<void> {
  await exportProjectBundle(projectId);
  revalidatePath("/deployments");
  revalidatePath("/websites");
  revalidatePath(`/projects/${projectId}`);
}

