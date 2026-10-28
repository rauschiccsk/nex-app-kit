// nex-app-kit — the frame of an ICC app, chosen by template in the app's manifest (DEV-250, DEV-251).
export { defineApp, ManifestError, NAV_LABEL_MAX, TEMPLATE_PATHS } from "./manifest";
export type { AgentRole, AiConfig, AppAuthMode, AppManifest, AppManifestInput, NavEntry } from "./manifest";
export { MODULES } from "./modules";
export type { ModuleDefinition } from "./modules";
export { TEMPLATE_IDS } from "./templates/ids";
export type { TemplateId } from "./templates/ids";
export { ADMIN_ROLE, PASSWORD_MIN_LENGTH, STANDARD_ENDPOINTS, STANDARD_ROLES, createStandardApi } from "./standard-api";
export type {
  AgentModelOption,
  AgentSettingRead,
  CurrentUser,
  EndpointId,
  EndpointScope,
  GettingStartedRead,
  HealthRead,
  LayoutLimit,
  NewUser,
  ProfileChanges,
  StandardApi,
  UserChanges,
  UserLayout,
  UserLayoutChanges,
} from "./standard-api";
export { TemplateApp } from "./TemplateApp";
export type { TemplateAppProps } from "./TemplateApp";
export { useFrame } from "./frame/FrameContext";
export type { Frame } from "./frame/FrameContext";
export { personName, roleLabel } from "./frame/people";
export { TEMPLATES } from "./templates/registry";
export type { TemplateProps } from "./templates/types";
