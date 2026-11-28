// DEV-535 — Sprievodca in an app on the template: „Ako urobiť“ with its conversation, a path composed from the app's
// catalog of steps, the guiding step by step (the step's screen opened, its button marked, moving on when the step is
// done — the person always clicks), and what it reports: stuck, a button not on the screen, a step the app did not see
// done, skipped, stopped and why, reached, a rating, an idea. The Director 28.11.2026: „…aby človek ktorý nikdy
// nevidel a ani nevie načo slúži sadol si k naším aplikáciám a začal používať.“
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route } from "react-router-dom";
import { setupServer } from "msw/node";
import { createApiClient } from "nex-shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { defineApp, ManifestError } from "../src/manifest";
import { previewHandlers } from "../src/preview";
import { createStandardApi } from "../src/standard-api";
import type { GuideCatalog, GuideStep } from "../src/guide/catalog";
import { STUCK_AFTER_MS, TARGET_WAIT_MS } from "../src/guide/GuideRunner";
import { useGuide } from "../src/guide/store";
import { BASE, frame, PLAIN_USER, renderApp, type Call } from "./helpers";

let uploaded = false;
let confirmed = false;
const listed = vi.fn(async () => [{ id: "a1", label: "Prvá oblasť" }]);

const STEPS: GuideStep[] = [
  {
    id: "area.upload",
    title: "Nahrať súbory",
    hint: "Kliknite Nahrať a vyberte súbory.",
    screen: "Oblasti → oblasť",
    path: (s) => `/areas/${s}`,
    subject: "area",
    isDone: () => uploaded,
  },
  {
    id: "area.confirm",
    title: "Potvrdiť priradenie",
    hint: "Kliknite Potvrdiť.",
    screen: "Oblasti → oblasť",
    path: (s) => `/areas/${s}`,
    subject: "area",
    requires: ["area.upload"],
    isAvailable: () => uploaded,
    isDone: () => confirmed,
  },
];
const CATALOG: GuideCatalog = { steps: STEPS, subjects: { area: { list: listed } } };
const PATH = [
  { id: "area.upload", subject: "a1", title: "Nahrať súbory" },
  { id: "area.confirm", subject: "a1", title: "Potvrdiť priradenie" },
];
const PLAN = { session_id: "s1", kind: "plan", text: "Nahráte súbory a potvrdíte ich priradenie.", steps: PATH, invalid: false, empty_catalog: false };
const SESSION = { id: "s1", goal: "", status: "guiding", steps: PATH, current_step: 0, stop_reason: null, rating: null, comment: null, created_at: null };

const ROUTES = (
  <Route
    path="/areas/:id"
    element={
      <div>
        <button type="button" data-guide="area.upload" onClick={() => (uploaded = true)}>
          Nahrať
        </button>
        <button type="button" data-guide="area.confirm" onClick={() => (confirmed = true)}>
          Potvrdiť
        </button>
      </div>
    }
  />
);

function app(answers: Record<string, unknown> = {}, path = "/getting-started", catalog: GuideCatalog = CATALOG) {
  return renderApp({
    path,
    extras: { guide: catalog },
    routes: ROUTES,
    answers: {
      "POST /guide/plan": PLAN,
      "POST /guide/sessions/s1/progress": (body: { status: string; current_step: number }) => ({ ...SESSION, ...body }),
      "POST /guide/sessions/s1/rating": { ...SESSION, status: "done", rating: "up" },
      "POST /guide/events": { recorded: "x" },
      ...answers,
    } as never,
  });
}

const sent = (calls: Call[], method: string, path: string) => calls.filter((c) => c.method === method && c.path === path).map((c) => c.body);

async function ask(goal = "Chcem nahrať súbory do oblasti.") {
  fireEvent.change(await screen.findByRole("textbox", { name: "Čo chcete urobiť?" }), { target: { value: goal } });
  fireEvent.click(screen.getByRole("button", { name: "Poslať" }));
}

async function lead() {
  await ask();
  fireEvent.click(await screen.findByRole("button", { name: "Veď ma krok za krokom" }));
  return screen.findByRole("dialog", { name: "Sprievodca" });
}

const EMPTY_GUIDE: Partial<ReturnType<typeof useGuide.getState>> = {
  owner: null,
  open: false,
  phase: "idle",
  sessionId: null,
  lines: [],
  steps: [],
  current: 0,
  stepSince: null,
  stuckReported: false,
  rated: false,
};

beforeEach(() => {
  uploaded = false;
  confirmed = false;
  window.localStorage.clear();
  useGuide.setState(EMPTY_GUIDE);
});
afterEach(() => vi.useRealTimers());

describe("Ako urobiť (DEV-535)", () => {
  it("measures the catalog, asks for a path and says it in short, with the steps", async () => {
    const { calls } = app();
    await ask();

    expect(await screen.findByText("Nahráte súbory a potvrdíte ich priradenie.")).toBeInTheDocument();
    const [body] = sent(calls, "POST", "/guide/plan") as Record<string, unknown>[];
    expect(body).toMatchObject({
      message: "Chcem nahrať súbory do oblasti.",
      language: "sk",
      subjects: { area: [{ id: "a1", label: "Prvá oblasť" }] },
    });
    expect((body!.catalog as { id: string; state: unknown; requires: string[] }[]).map((s) => [s.id, s.state, s.requires])).toEqual([
      ["area.upload", { a1: { available: true, done: false } }, []],
      ["area.confirm", { a1: { available: false, done: false } }, ["area.upload"]],
    ]);
    const steps = within(screen.getByTestId("guide-chat")).getAllByRole("listitem").map((li) => li.textContent);
    expect(steps).toEqual(expect.arrayContaining(["Nahrať súbory", "Potvrdiť priradenie"]));
  });

  it("an answer to Sprievodca's question continues the same conversation", async () => {
    const { calls } = app({
      "POST /guide/plan": (body: { session_id?: string }) =>
        body.session_id ? PLAN : { session_id: "s1", kind: "question", text: "Do ktorej oblasti?", steps: [], invalid: false, empty_catalog: false },
    });
    await ask("Chcem nahrať súbory.");
    await screen.findByText("Do ktorej oblasti?");
    await ask("Prvá oblasť");

    await screen.findByRole("button", { name: "Veď ma krok za krokom" });
    expect((sent(calls, "POST", "/guide/plan") as { session_id?: string }[]).map((b) => b.session_id)).toEqual([undefined, "s1"]);
  });

  it("a goal the catalog has no step for is said, and that it was noted", async () => {
    app({ "POST /guide/plan": { session_id: "s1", kind: "missing", text: "Chýba krok na export.", steps: [], invalid: false, empty_catalog: false } });
    await ask("Chcem export do XLSX.");
    expect(await screen.findByText("Chýba krok na export.")).toBeInTheDocument();
    expect(screen.getByText("Zapísal som, čo chýba — pomôže to aplikáciu vylepšiť.")).toBeInTheDocument();
  });

  it("an app without steps says so", async () => {
    app({ "POST /guide/plan": { session_id: "s1", kind: "missing", text: "", steps: [], invalid: false, empty_catalog: true } }, "/getting-started", { steps: [] });
    await ask();
    expect(await screen.findByText("Táto aplikácia zatiaľ nemá kroky, cez ktoré by som vás viedol. Zapísal som to.")).toBeInTheDocument();
  });

  it("an idea for improvement is written down", async () => {
    const { calls } = app();
    fireEvent.click(await screen.findByRole("button", { name: "Nápad na zlepšenie" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nápad na zlepšenie" }), { target: { value: "Nech ukáže čas." } });
    fireEvent.click(screen.getAllByRole("button", { name: "Poslať" }).at(-1)!);

    expect(await screen.findByText("Nápad je zapísaný. Ďakujem.")).toBeInTheDocument();
    expect(sent(calls, "POST", "/guide/events")).toEqual([{ kind: "idea", detail: "Nech ukáže čas." }]);
  });
});

describe("guiding step by step (DEV-535)", () => {
  it("opens the step's screen, marks its button and moves on by itself when the step is done; at the end asks for a rating", async () => {
    const { calls } = app();
    const card = await lead();

    expect(within(card).getByText(/Krok 1 z 2/)).toBeInTheDocument();
    expect(within(card).getByText("Kliknite Nahrať a vyberte súbory.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Nahrať" })).toHaveAttribute("data-guide-active", "true"));

    fireEvent.click(screen.getByRole("button", { name: "Nahrať" }));
    await waitFor(() => expect(within(card).getByText(/Krok 2 z 2/)).toBeInTheDocument(), { timeout: 4000 });
    await waitFor(() => expect(screen.getByRole("button", { name: "Potvrdiť" })).toHaveAttribute("data-guide-active", "true"));
    expect(screen.getByRole("button", { name: "Nahrať" })).not.toHaveAttribute("data-guide-active");

    fireEvent.click(screen.getByRole("button", { name: "Potvrdiť" }));
    expect(await screen.findByText("Hotovo — cieľ je dosiahnutý.", {}, { timeout: 4000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Áno/ }));
    await waitFor(() => expect(sent(calls, "POST", "/guide/sessions/s1/rating")).toEqual([{ rating: "up" }]));

    expect(sent(calls, "POST", "/guide/sessions/s1/progress")).toEqual([
      { status: "guiding", current_step: 0 },
      { status: "guiding", current_step: 1 },
      { status: "done", current_step: 2 },
    ]);
  }, 15000);

  it("a stop says why, and the card goes", async () => {
    const { calls } = app();
    const card = await lead();
    fireEvent.click(within(card).getByRole("button", { name: "Zastaviť" }));
    fireEvent.click(within(card).getByRole("button", { name: "Nebolo jasné, čo urobiť" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sprievodca" })).toBeNull());
    expect(sent(calls, "POST", "/guide/sessions/s1/progress").at(-1)).toEqual({ status: "stopped", current_step: 0, reason: "unclear" });
  });

  it("„Hotovo“ the app does not see is reported and the guiding goes on; „Preskočiť“ too", async () => {
    const { calls } = app();
    const card = await lead();
    fireEvent.click(within(card).getByRole("button", { name: "Hotovo" }));
    await within(card).findByText(/Krok 2 z 2/);
    fireEvent.click(within(card).getByRole("button", { name: "Preskočiť" }));

    await screen.findByText("Hotovo — cieľ je dosiahnutý.");
    expect(sent(calls, "POST", "/guide/events")).toEqual([
      { kind: "not_detected", session_id: "s1", step_id: "area.upload" },
      { kind: "skipped", session_id: "s1", step_id: "area.confirm" },
    ]);
  });

  it("a button not on the screen is said and reported", async () => {
    const missing: GuideCatalog = { ...CATALOG, steps: [{ ...STEPS[0]!, target: "area.nowhere" }, STEPS[1]!] };
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = app({}, "/getting-started", missing);
    const card = await lead();

    await act(async () => {
      vi.advanceTimersByTime(TARGET_WAIT_MS + 500);
    });
    expect(await within(card).findByText("Tlačidlo tohto kroku na obrazovke nevidím — zapísal som to.")).toBeInTheDocument();
    expect(sent(calls, "POST", "/guide/events")).toEqual([{ kind: "no_target", session_id: "s1", step_id: "area.upload" }]);
  });

  it("a long stay on a step is reported once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { calls } = app();
    await lead();

    await act(async () => {
      vi.advanceTimersByTime(STUCK_AFTER_MS + 5000);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await waitFor(() => expect(sent(calls, "POST", "/guide/events")).toEqual([{ kind: "stuck", session_id: "s1", step_id: "area.upload" }]));
  });

  it("the guiding survives a reload — the card is there again on the step it was", async () => {
    const first = app();
    await lead();
    first.unmount();
    // A reload: what the page held in memory is gone, and only what the browser kept comes back (emptying the memory
    // writes the browser's copy too — so the copy is put back before it is read).
    const kept = window.localStorage.getItem("nex_guide");
    useGuide.setState(EMPTY_GUIDE);
    window.localStorage.setItem("nex_guide", kept ?? "");
    await useGuide.persist.rehydrate();

    app({}, "/areas/a1");
    expect(within(await screen.findByRole("dialog", { name: "Sprievodca" })).getByText(/Krok 1 z 2/)).toBeInTheDocument();
  });

  it("another person signed in does not get the guiding of the previous one", async () => {
    const first = app();
    await lead();
    first.unmount();

    renderApp({ path: "/areas/a1", user: PLAIN_USER, extras: { guide: CATALOG }, routes: ROUTES });
    await frame();
    expect(screen.queryByRole("dialog", { name: "Sprievodca" })).toBeNull();
  });
});

describe("Sprievodca in the frame (DEV-535)", () => {
  it("the top bar opens the conversation beside any screen", async () => {
    app({}, "/areas/a1");
    const { header } = await frame();
    fireEvent.click(within(header).getByRole("button", { name: /Sprievodca/ }));

    const panel = await screen.findByRole("complementary", { name: "Sprievodca" });
    expect(within(panel).getByRole("textbox", { name: "Čo chcete urobiť?" })).toBeInTheDocument();
  });

  it("an app that switched it off has neither the button nor the conversation", async () => {
    renderApp({ path: "/getting-started", manifest: { guide: false } });
    const { header } = await frame();
    expect(within(header).queryByRole("button", { name: /Sprievodca/ })).toBeNull();
    expect(screen.queryByTestId("guide-chat")).toBeNull();
  });

  it("the admin sees in Nastavenia how it works", async () => {
    renderApp({
      path: "/settings",
      answers: {
        "GET /guide/feedback": {
          totals: { sessions: 3, done: 1, stopped: 1, missing: 1, guiding: 0, rated_up: 1, rated_down: 0 },
          sessions: [],
          events: [{ kind: "missing_step", step_id: null, detail: "Chýba krok na export.", goal: "Export", created_at: "2026-11-28T10:00:00Z" }],
        },
      },
    });
    fireEvent.click(await screen.findByRole("tab", { name: "Sprievodca" }));

    expect(await screen.findByText("Chýba krok v katalógu")).toBeInTheDocument();
    expect(screen.getByText("Chýba krok na export.")).toBeInTheDocument();
    expect(screen.getByText("1 / 0")).toBeInTheDocument();
  });

  it("a broken catalog stops the app before it starts, every problem named", () => {
    const broken: GuideCatalog = {
      steps: [
        { ...STEPS[0]!, subject: "box" },
        { ...STEPS[1]!, requires: ["area.unknown"] },
        { ...STEPS[1]! },
      ],
      subjects: {},
    };
    expect(() => defineApp(BASE, { guide: broken })).toThrow(
      new ManifestError([
        "Krok Sprievodcu „area.confirm“ je v katalógu dvakrát.",
        "Krok Sprievodcu „area.upload“ sa vzťahuje na „box“, ktorý katalóg nemá medzi objektmi.",
        "Krok Sprievodcu „area.confirm“ potrebuje „area.unknown“, ktorý v katalógu nie je.",
        "Krok Sprievodcu „area.confirm“ sa vzťahuje na „area“, ktorý katalóg nemá medzi objektmi.",
        "Krok Sprievodcu „area.confirm“ sa vzťahuje na „area“, ktorý katalóg nemá medzi objektmi.",
      ]),
    );
    expect(() => defineApp({ ...BASE, guide: "áno" as never })).toThrow(/Sprievodca \(guide\) je true alebo false/);
    expect(defineApp({ ...BASE, guide: false }, { guide: broken }).guide).toBe(false);
  });
});

describe("Sprievodca in the Vizuál preview (DEV-535)", () => {
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("the path is the catalog's first steps not done, said in the person's language", async () => {
    server.use(...previewHandlers({ manifest: defineApp(BASE, { guide: CATALOG }) }));
    const api = createStandardApi(createApiClient({ baseUrl: "http://nahlad.local", apiPrefix: "/api/v1", getToken: () => null }));

    const answer = await api.guidePlan({
      message: "Čokoľvek",
      catalog: [
        { id: "area.upload", title: "Nahrať súbory", hint: "", screen: "", subject_kind: "area", requires: [], state: { a1: { available: true, done: true } } },
        { id: "area.confirm", title: "Potvrdiť", hint: "", screen: "", subject_kind: "area", requires: [], state: { a1: { available: true, done: false } } },
      ],
      subjects: { area: [{ id: "a1", label: "Prvá" }] },
    });

    expect(answer.kind).toBe("plan");
    expect(answer.steps).toEqual([{ id: "area.confirm", subject: "a1", title: "Potvrdiť" }]);
    expect(answer.text).toMatch(/^V náhľade Sprievodca/);
    expect((await api.guideFeedback()).totals.sessions).toBe(0);
  });
});
