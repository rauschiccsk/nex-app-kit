# nex-app-kit — šablóny aplikácií ICC

Rám aplikácie podľa šablóny: ľavý panel, horná lišta, stránky Ako začať, Aktualizácie a Nastavenia a ich napojenie
na štandardné rozhranie servera. Aplikácia rám **nekopíruje** — používa ho pripnutý na verziu, ako nex-shared, a svoju
podobu opíše v jednom súbore, v manifeste. Vylepšenie šablóny dostane aplikácia povýšením verzie bez zmeny svojho kódu
(návrh DEV-250, fáza 1 DEV-251).

## Šablóny

| šablóna | odkiaľ | čo dodá |
|---|---|---|
| `nsv-standard` | kokpit nex-studio-visual | ľavý panel (Prehľad, Ako začať, voliteľné moduly a vlastné položky, Aktualizácie, čiara, Nastavenia; používateľ v pätičke; šírka a zbalenie pamätané pre každého na serveri), horná lišta (kde som, svetlá/tmavá téma), Ako začať, Aktualizácie, Nastavenia (Systém, Agenti, Moje konto, Používatelia, Relácie) |

## Manifest aplikácie

Jeden súbor `app.manifest.json`, ktorý čítajú frontend aj server:

```json
{
  "template": "nsv-standard",
  "name": "NEX Knowledge",
  "initials": "NK",
  "auth": "manager",
  "ai": { "roles": [{ "id": "assistant", "label": "Asistent" }] },
  "nav": [{ "label": "Oblasti", "path": "/areas", "icon": "🗂️" }],
  "settings": { "categories": [{ "id": "search", "label": "Hľadanie", "description": "…", "prefixes": ["search_"] }] }
}
```

`auth` je `password` (vlastné heslo) alebo `manager` (spustenie z NEX Managera). Zlá hodnota zastaví štart a každý
problém povie jednou vetou — frontend (`defineApp`) aj server (`load_manifest`) tými istými vetami. Položka ľavého
panela má najviac 22 znakov, ikonu, cestu s lomkou a nesmie zabrať cestu šablóny (`/`, `/getting-started`,
`/updates`, `/settings`).

**Spôsob prihlásenia riadi Nastavenia:** s vlastným heslom má aplikácia Používateľov a Moje konto na úpravu; pri
spustení z NEX Managera Používateľov nemá a Moje konto len ukáže účet, ktorý sa mení v NEX Manageri. Agenti sú len pri
aplikácii s AI. Používateľov a Agentov vidí len správca.

## Frontend

```tsx
import data from "../app.manifest.json";
const manifest = defineApp(data, { counts: { "/areas": useAreaCount } });   // počet pri položke (voliteľné)

<BrowserRouter>
  <TemplateApp manifest={manifest} frontendVersion={import.meta.env.VITE_APP_VERSION} overview={<OverviewPage />}>
    <Route path="/areas" element={<AreasPage />} />
  </TemplateApp>
</BrowserRouter>
```

Rám sám zistí, kto je prihlásený (`GET /auth/me`), a ukáže prihlásenie, vetu, že aplikáciu treba otvoriť znova
z NEX Managera, povinnú zmenu hesla alebo výpadok servera. Relácia je cookie, ku ktorej sa JavaScript nedostane —
vlastné stránky aplikácie volajú server klientom z nex-shared (`createApiClient({ baseUrl: "", apiPrefix: "/api/v1",
getToken: () => null })`) a cookie ide s nimi sama.

Štýl aplikácie (`src/index.css`):

```css
@import "tailwindcss";
@import "nex-shared/tokens.css";
@import "nex-app-kit/frame.css";
@source "../node_modules/nex-shared/dist";
```

Aplikácia inštaluje aj `@tailwindcss/typography` (Ako začať je v tvare Markdown).

## Server

Python balík `nex_app_kit` v priečinku `server/` (FastAPI, SQLAlchemy 2, Alembic):

```python
kit = AppKit(
    manifest=load_manifest(BASE_DIR / "app.manifest.json"),
    version=settings.app_version,
    session_factory=SessionLocal,
    settings=[SettingDefinition(key="search_limit", default="20", value_type="int", label="Počet výsledkov",
                                description="Koľko výsledkov ukáže hľadanie.", min=1, max=100)],
    docs_dir=BASE_DIR / "docs",
    manager=ManagerLink.from_env() if manifest.auth == "manager" else None,
)
kit.install(app)                                              # štandardné rozhranie pod /api/v1
kit.upgrade_database(engine)                                  # tabuľky kit_ pred migráciami aplikácie
kit.bootstrap_admin(os.environ.get("ADMIN_INITIAL_PASSWORD"))  # vlastné heslo: prvý správca „admin“
```

Vlastné cesty aplikácie sa pýtajú na prihláseného `Depends(kit.current_user)` (alebo `kit.require_admin`), nastavenia
čítajú `kit.settings.get_int("search_limit")` a model agenta `kit.agent_choice("assistant")`. Tabuľka aplikácie,
ktorá ukazuje na človeka, ukazuje na `kit_users.id`. Pri spustení z NEX Managera berie balík nastavenia
`MANAGER_LAUNCH_SIGNING_KEY`, `MANAGER_MODULE_SLUG`, `MANAGER_DEPLOY_SLUG`, `NEX_MANAGER_BASE_URL`,
`NEX_MANAGER_API_KEY` — tie, ktoré kokpit zapisuje.

Cesty, kto ich smie a pravidlá relácie opisuje [KONTRAKT.md](KONTRAKT.md).

## Ukážka

`demo/` je aplikácia na šablóne so skutočným serverom a Postgresom:

```
docker compose -f demo/docker-compose.yml up -d --build      # prihlásenie: admin / ukazka-start
docker compose -f demo/docker-compose.yml down -v
```

## Vývoj

```
npm ci
npm run lint        # typy frontendu
npm test            # skúšky frontendu
npm run build       # dist/ (je v gite — aplikácie inštalujú zo značky bez stavby)
docker compose -p kit-test -f server/docker-compose.test.yml run --rm --build test   # skúšky servera na Postgrese
docker compose -p kit-test -f server/docker-compose.test.yml down -v
```

Verzia = značka `vX.Y.Z`; každá verzia má záznam v [CHANGELOG.md](CHANGELOG.md).
