// The frame around every page of „NSV štandard“: the left panel, the top bar, and the page in between.
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useStore } from "zustand";
import { AppShell } from "nex-shared";

import { useFrame } from "../../frame/FrameContext";
import { PageErrorBoundary } from "./PageErrorBoundary";
import { NsvSidebar } from "./Sidebar";
import { NsvTopbar } from "./Topbar";

export function NsvShell() {
  const { user, layout } = useFrame();
  const load = useStore(layout, (s) => s.load);
  const reset = useStore(layout, (s) => s.reset);
  const userId = user?.id;

  // The person's own layout — read once per signed-in person; nothing of the previous person's stays.
  useEffect(() => {
    reset();
    if (userId) void load();
  }, [userId, load, reset]);

  return (
    <AppShell sidebar={<NsvSidebar />} header={<NsvTopbar />}>
      <PageErrorBoundary>
        <Outlet />
      </PageErrorBoundary>
    </AppShell>
  );
}
