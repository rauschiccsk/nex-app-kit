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
const manifest = defineApp(data, {
  counts: { "/areas": useAreaCount },        // počet pri položke (voliteľné)
  visible: { "/statutory": useIsStatutory }, // kto položku vidí — ukáže sa, keď háčik povie áno (voliteľné);
                                             // "/" je Prehľad: kto ho nevidí, začína na prvej položke, ktorú vidí
  userActions: (person) => <AccessButton person={person} />, // tlačidlo aplikácie v riadku človeka v Nastaveniach (voliteľné)
});

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


## Obrazovky a tabuľky (DEV-517, od v0.20.0)

Každú obrazovku aplikácie stavaj cez `KitPage` (namiesto `Page` z nex-shared): keď na ňu človek prišiel z inej
obrazovky, má nad nadpisom „← názov predchádzajúcej obrazovky“ a vráti sa ním aj s filtrom a záložkou, postupne cez
viac krokov; položka ľavého panela (aj obrazovky šablóny) začína novú cestu. Keď nadpis nie je obyčajný text, daj
obrazovke meno pre šípku ďalšej obrazovky v `crumb`.

```tsx
<KitPage title={invoice.number} actions={<Button>Upraviť</Button>}>
  <KitFields rows={[{ label: "Dodávateľ", value: invoice.supplier }]} />
  <KitTable columns={columns} rows={invoice.items} getRowKey={(i) => i.id} />
</KitPage>
```

Tabuľky stavaj cez `KitTable` (DataTable z nex-shared s tesnými riadkami — tlačidlá a polia v bunke riadok
nenaťahujú) a zoznam pole–hodnota (hlavička dokladu, súhrn) cez `KitFields`. Riadky sú čo najnižšie pri čitateľnom
texte. Vzniklo vo Vizuáli NEX DualBook 0.1.0 (26.11.2026) na pokyn: „…pre všetky nové projekty a ne riešiť ich
osobitne.“

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
čítajú `kit.settings.get_int("search_limit")` a model agenta `kit.agent_choice("assistant")`. Nastavenie s výberom
z ponuky aplikácie dostane `SettingDefinition(..., choices=lambda: [("g-1", "Vedenie"), …])`; o každej zmene nastavenia
sa aplikácia dozvie cez `AppKit(..., on_setting_change=lambda db, key, old, new, user: …)` v tej istej transakcii, aby
si ju zapísala do svojho denníka. Rovnako sa dozvie, keď šablóna človeku ukončí prihlásenie jeho úkonom alebo úkonom
správcu (`AppKit(..., on_account_change=lambda db, user, event: …)`, `AccountEvent` — odhlásenie, zmena hesla, nové
heslo od správcu, vypnutie, zrušenie relácie, zmazanie); NEX Manager tak odhlási človeka aj v aplikáciách spustených
z neho. Tabuľka aplikácie,
ktorá ukazuje na človeka, ukazuje na `kit_users.id`. Pri spustení z NEX Managera berie balík nastavenia
`MANAGER_LAUNCH_SIGNING_KEY`, `MANAGER_MODULE_SLUG`, `MANAGER_DEPLOY_SLUG`, `NEX_MANAGER_BASE_URL`,
`NEX_MANAGER_API_KEY` — tie, ktoré kokpit zapisuje.

**Komu inštalácia slúži (DEV-377).** Kokpit pri každom nasadení zapíše backendu inštalácie `NEX_CUSTOMER_NAME` (meno
zákazníka) a `NEX_ENVIRONMENT` (`uat` / `prod`) — aplikácia ich nikde nedeklaruje. Server ich vydá (`GET
/installation`) a rám ich ukáže: v názve okna („NEX Manager — MÁGERSTAV s.r.o. (UAT)“), v ľavom paneli, na karte
prihlásenia a UAT dostane nad každou stránkou pás „Skúšobné prostredie (UAT)“. Nainštalovaná aplikácia sa pomenuje
tými istými slovami (`GET /installation/manifest.webmanifest`, ikona `/icon.svg` z kostry). Bez nich (aplikácia mimo
kokpitu) vyzerá ako doteraz.

Cesty, kto ich smie a pravidlá relácie opisuje [KONTRAKT.md](KONTRAKT.md).

**Claude len cez predplatné (DEV-460).** Aplikácia s AI volá Clauda výhradne cez `nex_app_kit.claude` — Claude Code
s ročným kódom predplatného Claude (`claude setup-token`) v `CLAUDE_CODE_OAUTH_TOKEN`, nikdy knižnicou `anthropic`
s kľúčom API (štandard ICC D-001). Vlastný prístup ku Claudovi aplikácia nepíše. Kostra aplikácie s AI dostane Claude
Code v obraze servera a v `.env.example` povinné tajomstvo zákazníka „Ročný kód predplatného Claude“.

```python
from nex_app_kit import claude

answer = claude.ask(prompt, family=kit.agent_choice("assistant").model or "sonnet", system=SYSTEM,
                    schema=Result.model_json_schema(), images=[claude.Image(png, "image/png")], timeout=300)
answer.data, answer.model, answer.usage, answer.cost_usd     # štruktúrovaný výstup, presný model, spotreba
status = claude.check(language)                               # „ok“ alebo kód chyby a veta pre človeka
```

Rodina je `fable`, `opus`, `sonnet` alebo `haiku` (nikdy pevná verzia) — na najnovší model ju preloží Claude Code,
preto ho kostra inštaluje v obraze až za kódom aplikácie a každá nová verzia vezme najnovší (od v0.19.0, DEV-490).
`answer.model` je model zvolenej rodiny, ktorý naozaj odpovedal (nie pomocný model, ktorý Claude Code uvedie vedľa).
Rodinu, ktorú Claude Code nepozná, nikdy nenahradí iný model: volanie zlyhá kódom `model_unavailable`. Zlyhanie je
`claude.ClaudeFailure` s kódom (`token_missing`, `token_rejected`, `limit`, `timeout`, `unavailable`, `bad_answer`,
`model_unavailable`) a vetou v jazyku človeka (`failure.sentence(language)`). Volanie je synchrónne — z asynchrónnej
cesty ho aplikácia spúšťa cez `asyncio.to_thread` alebo vo svojom workeri.

## Kostra nového projektu

`scaffold/<šablóna>/` je to, čo kokpit zapíše do nového projektu na šablóne: frontend s rámom a náhľadom Vizuálu,
`frontend/app.manifest.json`, server na AppKit, docker-compose a blok `.env.example`. Vypĺňa ju `scaffold/render.py`
(len štandardná knižnica Pythonu):

```
python3 scaffold/render.py nsv-standard --values values.json --into <projekt>   # nad projektom, ktorý založil init.sh
python3 scaffold/render.py nsv-standard --values values.json --out <prázdny priečinok>
```

Hodnoty a ich význam opisuje hlavička `render.py`. CI vyplní kostru každým commitom pre oba spôsoby prihlásenia,
postaví ju v Dockeri, pustí skúšky frontendu aj servera a overí, že celá aplikácia odpovedá.

V náhľade Vizuálu (bez servera) odpovedá rám sám: `frontend/src/preview/handlers.ts` skladá
`previewHandlers({ manifest })` z `nex-app-kit/preview` a za ne odpovede vlastných obrazoviek aplikácie. Aplikácia, ktorej
obrazovky ukazujú ľudí, dá svojich ukážkových ľudí aj rámu (`previewHandlers({ manifest, user, users })`), aby
Nastavenia → Používatelia ukázali tých istých.

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
