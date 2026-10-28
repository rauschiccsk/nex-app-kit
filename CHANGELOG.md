# Changelog — nex-app-kit

Rám aplikácií ICC podľa šablóny. Každá verzia zodpovedá jednej značke v gite (`vX.Y.Z`); aplikácie si nex-app-kit
pripínajú na konkrétnu verziu. Značky pri zmenách ako v nex-shared: `[vzhľad]`, `[API]`, `[nové]`, `[oprava]`.

> **Pravidlo:** žiadna nová verzia (zmena `package.json` + značka) bez záznamu v tomto súbore — stráži to CI.

---

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
