# Changelog — nex-app-kit

Rám aplikácií ICC podľa šablóny. Každá verzia zodpovedá jednej značke v gite (`vX.Y.Z`); aplikácie si nex-app-kit
pripínajú na konkrétnu verziu. Značky pri zmenách ako v nex-shared: `[vzhľad]`, `[API]`, `[nové]`, `[oprava]`.

> **Pravidlo:** žiadna nová verzia (zmena `package.json` + značka) bez záznamu v tomto súbore — stráži to CI.

---

## v0.6.0
- `[nové]` **Náhľad Vizuálu ukáže v Nastaveniach → Používatelia ukážkových ľudí aplikácie**
  (`previewHandlers({ manifest, user, users })`). Prihlásený človek je medzi nimi vždy — ten s rovnakým `id`, inak
  pribudne na začiatok; chýbajúce polia sa doplnia a úprava človeka zachová, čo nemení. Bez `users` ostáva náhľad,
  ako bol. V náhľade NEX Managera 1.5.0 ukazovali Nastavenia dvoch ľudí a „Ľudia a prístupy“ ôsmich (DEV-292).

## v0.5.0
- `[nové]` **Aplikácia sa dozvie, keď šablóna človeku ukončí prihlásenie** (`AppKit(on_account_change=…)`,
  `AccountEvent`): odhlásenie, zmena vlastného hesla, nové heslo od správcu, vypnutie účtu, zrušenie relácie
  v Reláciách a zmazanie používateľa — v tej istej transakcii ako úkon, takže zápis aplikácie stojí a padá s ním.
  Uplynutie času ani nepotvrdenie z NEX Managera úkon nie je. NEX Manager na šablóne tak naďalej odhlási človeka aj
  v aplikáciách spustených z neho (DEV-290).
- `[API]` `Sessions.end_all` prijme `event=`; bez neho končí relácie ako doteraz a aplikácii nič nehlási. Nová
  `Sessions.revoke` pre zrušenie jednej relácie (DEV-290).
- `[oprava]` `package-lock.json` nesie číslo verzie balíka (stálo na 0.3.0).

## v0.4.0
- `[nové]` **Položka ľavého panela len pre niektorých ľudí** (`defineApp(data, { visible: { "/statutory": useIsStatutory } })`).
  Háčik aplikácie rozhodne; položka sa ukáže, až keď povie áno. NEX Knowledge tak drží Uchovávanie len pre konateľov
  (DEV-257).
- `[nové]` **Systémové nastavenie s výberom z ponuky aplikácie** (`SettingDefinition(choices=…)`, nex-shared v0.29.0).
  Server pošle ponuku pri zozname nastavení, hodnotu mimo nej odmietne a keď sa ponuka nedá načítať, povie to
  (`503 KIT-UNAVAILABLE`) (DEV-257).
- `[nové]` **Aplikácia sa dozvie o zmene nastavenia** (`AppKit(on_setting_change=…)`) v tej istej transakcii — zápis do
  jej denníka stojí a padá so zmenou (DEV-257).
- `[API]` Riadok systémového nastavenia nesie pole `choices` (KONTRAKT.md); šablóna stojí na nex-shared v0.29.0.

## v0.3.0
- `[nové]` **Kostra šablóny** (`scaffold/nsv-standard/`, `scaffold/render.py`): frontend s rámom a náhľadom Vizuálu,
  `app.manifest.json`, server na AppKit (FastAPI, SQLAlchemy, Alembic — tabuľky šablóny pred tabuľkami aplikácie,
  skúšky na Postgrese), docker-compose (db, migrate, backend, frontend, test), blok `.env.example` podľa spôsobu
  prihlásenia a `docs/AKO_ZACAT.md`. Kokpit ju vyplní pri zakladaní projektu; CI ju vyplní každým commitom, postaví
  a pustí jej skúšky (DEV-253).
- `[nové]` **Odpovede pre náhľad Vizuálu** (`nex-app-kit/preview`, `previewHandlers`): rám sa v náhľade bez servera
  otvorí prihlásený, s celým ľavým panelom a Nastaveniami; agent píše odpovede len pre vlastné obrazovky (DEV-253).
- `[nové]` **Migrácie šablóny zvnútra migrácií aplikácie** (`upgrade_database`) — jeden príkaz `alembic upgrade head`
  pripraví tabuľky šablóny aj aplikácie (DEV-253).
- `[nové]` Aplikácia spúšťaná z NEX Managera naštartuje aj bez prepojenia; spustenie vtedy povie, že prepojenie chýba.
  Stav servera odpovedá aj na `/health` (sondy kokpitu a Docker) (DEV-253).
- `[oprava]` Nastavenia prihlásenia šablóny sú opísané raz (`kit_settings.json`) pre server aj náhľad (DEV-253).

## v0.2.0
- `[nové]` **Server šablóny** (`server/`, Python balík `nex_app_kit`): celé štandardné rozhranie z KONTRAKT.md —
  prihlásenie vlastným heslom aj spustením z NEX Managera, moje konto, používatelia, relácie, systémové nastavenia,
  agenti, aktualizácie, Ako začať a rozloženie obrazovky; vlastné tabuľky `kit_` a migrácie (DEV-252).
- `[nové]` **Relácia v databáze** pre oba spôsoby prihlásenia: cookie, ku ktorej sa JavaScript nedostane; odhlásenie
  po nečinnosti a najneskôr po najdlhšej dobe (systémové nastavenia v kategórii Prihlásenie); zrušená relácia
  prestane platiť hneď; požiadavka z cudzej stránky je odmietnutá (DEV-252).
- `[API]` **Rám sám zistí, kto je prihlásený** (`TemplateApp` bez `user` a `onLogout`): ukáže prihlásenie, vetu
  o NEX Manageri, povinnú zmenu hesla alebo výpadok servera; odhlásenie robí rám. Klient (`client`) je voliteľný
  (DEV-252).
- `[nové]` **Manifest je súbor `app.manifest.json`**, ktorý čítajú frontend (`defineApp(data, { counts })`)
  aj server (`load_manifest`); spoločné pravidlá majú spoločné skúšobné prípady (DEV-252).
- `[nové]` Zmluva doplnila prihlásenie, odhlásenie a spustenie z NEX Managera a pravidlá relácie; pripnutý
  nex-shared v0.28.0 (Relácie bez stĺpca „tv“ a s vetou, čo znamená zrušenie) (DEV-252).

## v0.1.0
- `[nové]` **Manifest aplikácie** (`defineApp`): šablóna, názov, iniciály, spôsob prihlásenia, AI a roly agentov,
  voliteľné moduly, vlastné položky ľavého panela, kategórie systémových nastavení. Zlá hodnota zastaví štart s vetou,
  čo je zle (DEV-251).
- `[nové]` **Šablóna „NSV štandard“** z kokpitu: ľavý panel, horná lišta, Ako začať, Aktualizácie, Nastavenia
  (`TemplateApp`); šírka a zbalenie ľavého panela pamätané pre každého na serveri; svetlá/tmavá téma pre každého;
  stránka, ktorá spadne, to povie a rám ostane (DEV-251).
- `[nové]` **Štandardné rozhranie servera** (`createStandardApi`, `STANDARD_ENDPOINTS`, KONTRAKT.md): cesty, kedy
  ich aplikácia má, roly a oprávnenia (DEV-251).
- `[nové]` **Spoločný štýl rámu** (`nex-app-kit/frame.css`): písmo kokpitu (13/15 px, hrúbka 450) a výška stránky.
