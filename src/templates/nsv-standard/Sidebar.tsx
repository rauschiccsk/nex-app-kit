// The left panel of „NSV štandard“, as the cockpit has it (Sidebar.tsx of nex-studio-visual): Prehľad, Ako začať,
// the optional modules and the app's own entries, Aktualizácie, a line, Nastavenia; the person in the footer; the
// width and the collapsed state kept on the server for each person.
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { Brand, NavIcon, NavItem, SectionDivider, Sidebar, UserCard, useShell } from "nex-shared";

import { useFrame } from "../../frame/FrameContext";
import { personName, roleLabel } from "../../frame/people";
import { useBackendVersion, versionLine } from "../../frame/version";
import type { NavEntry } from "../../manifest";
import { MODULES } from "../../modules";
import { TEMPLATE_PLACES } from "./places";

function useIsActive() {
  const { pathname } = useLocation();
  return (path: string) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));
}

function CountedEntry({ entry, active, onClick }: { entry: NavEntry; active: boolean; onClick: () => void }) {
  const count = entry.useCount?.() ?? undefined;
  return <NavItem icon={<NavIcon glyph={entry.icon} />} label={entry.label} active={active} onClick={onClick} count={count ?? undefined} />;
}

/** DEV-257: an entry only some people have — its hook decides; not shown until it says yes. */
function VisibleEntry({ entry, children }: { entry: NavEntry & { useVisible: () => boolean | null | undefined }; children: ReactNode }) {
  return entry.useVisible() === true ? <>{children}</> : null;
}

export function NsvSidebar() {
  const { manifest, api, user, isAdmin, onLogout, frontendVersion, layout: store } = useFrame();
  const layout = useStore(store, (s) => s.layout);
  const saveLayout = useStore(store, (s) => s.save);
  const navigate = useNavigate();
  const isActive = useIsActive();
  const backendVersion = useBackendVersion(api);
  // On a narrow screen the panel is the shell's drawer and is never collapsed to icons.
  const { narrow } = useShell();
  const railCollapsed = layout?.sidebar_collapsed ?? false;
  const limit = layout?.limits.sidebar_width;

  const name = personName(user) || user?.email || "";
  const footer = (
    <UserCard
      initials={name ? name.slice(0, 1).toUpperCase() : "?"}
      name={name || "—"}
      subtitle={roleLabel(user?.role)}
      onLogout={onLogout}
    />
  );

  const entry = (place: { path: string; label: string; icon: string }) => (
    <NavItem
      key={place.path}
      icon={<NavIcon glyph={place.icon} />}
      label={place.label}
      active={isActive(place.path)}
      onClick={() => navigate(place.path)}
    />
  );
  const modules = manifest.modules.flatMap((id) => (MODULES[id] ? [MODULES[id]] : []));
  const ownEntries = manifest.nav.filter((e) => !e.adminOnly || isAdmin);

  return (
    <Sidebar
      collapsed={railCollapsed && !narrow}
      onToggleCollapse={() => void saveLayout({ sidebar_collapsed: !railCollapsed })}
      logo={<Brand initials={manifest.initials} name={manifest.name} version={versionLine(backendVersion, frontendVersion)} />}
      footer={footer}
      dense
      width={layout?.sidebar_width ?? undefined}
      // The default width is kept as „none chosen“ — it then follows the default if that ever changes.
      onWidthChange={limit ? (w) => void saveLayout({ sidebar_width: w === limit.default ? null : w }) : undefined}
      minWidth={limit?.min}
      maxWidth={limit?.max}
      defaultWidth={limit?.default}
    >
      {entry(TEMPLATE_PLACES.overview)}
      {entry(TEMPLATE_PLACES.gettingStarted)}
      {modules.map((m) => entry(m))}
      {ownEntries.map((e) => {
        const shown = e.useCount ? (
          <CountedEntry key={e.path} entry={e} active={isActive(e.path)} onClick={() => navigate(e.path)} />
        ) : (
          entry(e)
        );
        const { useVisible } = e;
        return useVisible ? (
          <VisibleEntry key={e.path} entry={{ ...e, useVisible }}>
            {shown}
          </VisibleEntry>
        ) : (
          shown
        );
      })}
      {entry(TEMPLATE_PLACES.updates)}
      <SectionDivider />
      {entry(TEMPLATE_PLACES.settings)}
    </Sidebar>
  );
}
