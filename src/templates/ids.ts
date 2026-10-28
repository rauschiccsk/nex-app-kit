// The templates the kit knows. A new template is a new folder under src/templates and its id here — an app picks it in
// its manifest; apps on another template are not touched.
export const TEMPLATE_IDS = ["nsv-standard"] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];
