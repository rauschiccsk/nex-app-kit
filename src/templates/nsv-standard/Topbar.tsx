// The top bar of „NSV štandard“: where you are (the name of the place in the left panel) and the light/dark switch,
// as in the cockpit's Topbar.tsx.
import { useLocation } from "react-router-dom";
import { Header, ThemeToggle } from "nex-shared";

import { useFrame } from "../../frame/FrameContext";
import { useTheme } from "../../frame/theme";
import type { AppManifest } from "../../manifest";
import { MODULES } from "../../modules";
import { TEMPLATE_PLACES } from "./places";

/** The place's name: exact first, then the entry the address lies under (/areas/12 → Oblasti), else the app's name. */
export function placeLabel(pathname: string, manifest: AppManifest): string {
  const places = [
    ...Object.values(TEMPLATE_PLACES),
    ...manifest.modules.flatMap((id) => (MODULES[id] ? [MODULES[id]] : [])),
    ...manifest.nav,
  ];
  const exact = places.find((p) => p.path === pathname);
  if (exact) return exact.label;
  const under = places
    .filter((p) => p.path !== "/" && pathname.startsWith(`${p.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return under?.label ?? manifest.name;
}

export function NsvTopbar() {
  const { manifest } = useFrame();
  const { pathname } = useLocation();
  const { isDark, toggleDark } = useTheme();

  return (
    <Header
      left={
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden text-xs text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-muted)]">/</span>
          <span className="text-[var(--color-text-secondary)] truncate">{placeLabel(pathname, manifest)}</span>
        </div>
      }
      right={<ThemeToggle theme={isDark ? "dark" : "light"} onToggle={toggleDark} />}
    />
  );
}
