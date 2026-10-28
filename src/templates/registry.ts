// Template id → its frame. A new template is a new folder under src/templates, its id in ids.ts and a line here;
// the type makes a missing line a build error.
import type { ComponentType } from "react";

import type { TemplateId } from "./ids";
import { NsvStandard } from "./nsv-standard/NsvStandard";
import type { TemplateProps } from "./types";

export const TEMPLATES: Readonly<Record<TemplateId, ComponentType<TemplateProps>>> = Object.freeze({
  "nsv-standard": NsvStandard,
});
