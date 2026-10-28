# Changelog — nex-app-kit

Rám aplikácií ICC podľa šablóny. Každá verzia zodpovedá jednej značke v gite (`vX.Y.Z`); aplikácie si nex-app-kit
pripínajú na konkrétnu verziu. Značky pri zmenách ako v nex-shared: `[vzhľad]`, `[API]`, `[nové]`, `[oprava]`.

> **Pravidlo:** žiadna nová verzia (zmena `package.json` + značka) bez záznamu v tomto súbore — stráži to CI.

---

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
