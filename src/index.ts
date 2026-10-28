// nex-app-kit — the frame of an ICC app, chosen by template in the app's manifest (DEV-250, DEV-251).
export { defineApp, ManifestError, NAV_LABEL_MAX, TEMPLATE_PATHS } from "./manifest";
export type { AgentRole, AiConfig, AppAuthMode, AppManifest, AppManifestInput, NavEntry } from "./manifest";
export { MODULES } from "./modules";
export type { ModuleDefinition } from "./modules";
export { TEMPLATE_IDS } from "./templates/ids";
export type { TemplateId } from "./templates/ids";
export { STANDARD_ENDPOINTS, createStandardApi } from "./standard-api";
export type {
  AgentModelOption,
  AgentSettingRead,
  CurrentUser,
  EndpointId,
  EndpointScope,
  GettingStartedRead,
  HealthRead,
  NewUser,
  ProfileChanges,
  StandardApi,
  UserChanges,
  UserLayout,
} from "./standard-api";
