# Štandardné rozhranie servera — nex-app-kit

Každá aplikácia na šablóne nex-app-kit odpovedá na tieto cesty. Rám šablóny (ľavý panel, horná lišta, Ako začať,
Aktualizácie, Nastavenia) volá len ich; serverový balík nex-app-kit (`server/`, Python) ich dodá hotové. Cesty sú pod
predponou `/api/v1`.

Tabuľku nižšie strážia dve skúšky: `test/standard-api.test.ts` ju porovná s tabuľkou `STANDARD_ENDPOINTS`
frontendu a `server/tests/test_contract.py` so skutočnými cestami servera pre každý spôsob prihlásenia, s AI aj bez
nej — cesta, ktorá chýba alebo pribudla len na jednej strane, je červená.

**Kedy cesta existuje:**
- **vždy** — každá aplikácia;
- **heslo** — len aplikácia s vlastným prihlásením (`auth: "password"`); pri spustení z NEX Managera
  (`auth: "manager"`) sú používatelia a ich heslá v NEX Manageri a záložka Používatelia v Nastaveniach nie je;
- **NEX Manager** — len aplikácia spúšťaná z NEX Managera (`auth: "manager"`);
- **AI** — len aplikácia s agentmi (`ai` v manifeste); záložka Agenti v Nastaveniach je len pri nej.

## Cesty

| cesta | kedy | čo robí |
|---|---|---|
| `POST /auth/login` | heslo | Prihlásenie: `username`, `password`; nastaví cookie relácie a vráti prihláseného. |
| `POST /auth/logout` | vždy | Odhlásenie: ukončí reláciu tohto prehliadača. |
| `GET /launch` | NEX Manager | Spustenie z NEX Managera: lístok `lt` v adrese; po overení presmeruje do aplikácie. |
| `POST /launch` | NEX Manager | To isté s lístkom `lt` vo formulári alebo v JSON. |
| `GET /health` | vždy | Stav aplikácie: `status`, `version`, `checks` (napr. `database`). |
| `GET /auth/me` | vždy | Prihlásený používateľ (rovnaké polia ako riadok používateľa, navyše `must_change_password`). |
| `PATCH /auth/me` | heslo | Moje konto: zmena e-mailu, mena a priezviska vlastného účtu. |
| `POST /auth/change-password` | heslo | Zmena vlastného hesla: `current_password`, `new_password`. |
| `GET /users` | heslo | Zoznam používateľov (len admin). |
| `POST /users` | heslo | Nový používateľ: `username`, `email`, `password`, `role`, `first_name`, `last_name`, `is_active`. |
| `PATCH /users/{id}` | heslo | Úprava používateľa: `email`, `role`, `first_name`, `last_name`, `is_active`. |
| `DELETE /users/{id}` | heslo | Zmazanie používateľa. |
| `POST /users/{id}/password` | heslo | Nové heslo inému používateľovi (admin): `new_password`. |
| `GET /sessions` | vždy | Relácie — kto je prihlásený, odkedy, naposledy aktívny, prehliadač; `current` = táto. |
| `DELETE /sessions/{id}` | vždy | Zrušenie relácie — prestane platiť hneď. |
| `GET /system-settings` | vždy | Systémové nastavenia aplikácie: kľúč, hodnota, typ, popis, predvolená hodnota, ponuka (`choices`). |
| `PATCH /system-settings/{key}` | vždy | Zmena jedného nastavenia: `value`; pri nastavení s ponukou len hodnota z nej. |
| `GET /agent-settings` | AI | Model a úsilie pre každú rolu agenta z manifestu. |
| `GET /agent-settings/models` | AI | Modely na výber (rodina — opus, sonnet, haiku —, nikdy verzia). |
| `PUT /agent-settings/{role}` | AI | Uloženie modelu a úsilia pre rolu: `model`, `effort`. |
| `GET /user-layout` | vždy | Rozloženie obrazovky prihláseného používateľa: `sidebar_width`, `sidebar_collapsed` a hranice šírky `limits.sidebar_width` (`min`, `max`, `default`). |
| `PUT /user-layout` | vždy | Uloženie rozloženia; posielajú sa len zmenené polia, šírka `null` = predvolená, šírka mimo hraníc = 422. |
| `GET /release-notes` | vždy | Aktualizácie: zoznam verzií s textom poznámok k vydaniu (`version`, `released_at`, `markdown`). |
| `GET /getting-started` | vždy | Ako začať: návod k aplikácii v tvare Markdown (`markdown`). |

## Prihlásenie a relácia

- Relácia je v databáze, jedna na prehliadač. Prehliadač má len cookie `nex_session`, ku ktorej sa JavaScript
  nedostane (HttpOnly, SameSite=Lax, Secure); v databáze je len jej odtlačok (SHA-256).
- Relácia skončí po nečinnosti (`auth_session_idle_minutes`, predvolene 480) a najneskôr po
  `auth_session_max_hours` (predvolene 24) — obe sú systémové nastavenia v kategórii Prihlásenie; ďalej odhlásením,
  zrušením v Reláciách, zmenou hesla (ostatné prehliadače) a novým heslom od správcu (všetky).
- **Vlastné heslo:** prvý správca `admin` vznikne z `ADMIN_INITIAL_PASSWORD` a pri prvom prihlásení si heslo musí
  zmeniť. Kým má zmenu hesla pred sebou, otvorí len `GET /auth/me`, `POST /auth/change-password` a odhlásenie; ostatné
  vráti 403 s kódom `KIT-PASSWORD-CHANGE`. Po 5 zlých heslách za sebou čaká účet 15 minút (429).
- **NEX Manager:** lístok podpísaný kľúčom `MANAGER_LAUNCH_SIGNING_KEY` (`iss=nex-manager`, `aud` = modul,
  `deploy`, `purpose=module-launch`, najviac 60 s) platí raz. Kto človek je a či má k modulu prístup, povie NEX
  Manager (`NEX_MANAGER_BASE_URL`, `NEX_MANAGER_API_KEY`) pri spustení a znova každých 5 minút; keď ho už nepotvrdí,
  relácia skončí. Ľudia sú v aplikácii len ako zrkadlo z NEX Managera.
- Bez relácie vráti každá cesta okrem verejných 401 s kódom `KIT-AUTH-REQUIRED`; veta pri spustení z NEX Managera
  povie, že aplikáciu treba otvoriť znova z neho.
- Požiadavku, ktorá niečo mení a prišla zo stránky inej adresy, server odmietne (403 `KIT-ORIGIN`).
- Verejné sú len `GET /health`, `GET /release-notes` a prihlásenie či spustenie. Stav servera odpovedá aj na `/health`
  mimo predpony `/api/v1` — pýtajú sa tam sondy kokpitu a Docker.

## Roly a oprávnenia

Aplikácia má dve roly: `admin` (Správca) a `user` (Používateľ). Heslo má aspoň 8 znakov (`PASSWORD_MIN_LENGTH`).

- **Používatelia** a nové heslo inému — len `admin`.
- **Systémové nastavenia** vidí každý, mení len `admin`; zmena platí najneskôr do 30 sekúnd (tak to hovorí aj panel Systém).
- **Agenti** platia pre celú aplikáciu — vidí a mení ich len `admin`.
- **Relácie** — `admin` vidí a ruší všetky, `user` vidí len svoje.
- **Ako začať** vidí každý prihlásený.
- **Moje konto** a **rozloženie** patria vždy prihlásenému — v ceste nie je id, nikto nečíta ani nemení cudzie.

## Tvar odpovedí

Polia používateľa, relácie a systémového nastavenia sú tie, ktoré zobrazujú panely Nastavení v nex-shared
(`UserRead`, `UserSessionRead`, `SystemSettingRead`); ostatné tvary opisujú typy v `src/standard-api.ts`.
Chyba prichádza v tvare `{"detail": "…", "code": "KIT-…"}`: `detail` je veta pre človeka po slovensky, `code` pre
záznamy a skúšky. Neúspešné spustenie z NEX Managera skončí v prehliadači stránkou s tou istou vetou.

Systémové nastavenie nesie `choices`: `null` bez ponuky, inak zoznam `{value, label}` z ponuky aplikácie (napríklad
skupiny z NEX Managera); prázdny zoznam znamená, že aplikácia ponuku teraz nevie načítať. Zmena na hodnotu mimo ponuky
je `422 KIT-INVALID`, zmena, keď sa ponuka nedá načítať, `503 KIT-UNAVAILABLE`.

## Dokumenty aplikácie

- Aktualizácie: `docs/specs/versions/v<verzia>/RELEASE_NOTES.md`, dátumy v
  `docs/specs/versions/release-dates.json` (`{"v1.4.2": "2026-10-28"}`); úvodný nadpis s verziou sa vynechá.
- Ako začať: `docs/AKO_ZACAT.md` — návod pre človeka, ktorý aplikáciu ešte nevidel.
