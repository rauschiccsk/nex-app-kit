# Štandardné rozhranie servera — nex-app-kit

Každá aplikácia na šablóne nex-app-kit odpovedá na tieto cesty. Rám šablóny (ľavý panel, horná lišta, Ako začať,
Aktualizácie, Nastavenia) volá len ich; serverový balík nex-app-kit (fáza 2) ich dodá hotové. Cesty sú pod
predponou `/api/v1`.

Jediný zdroj je tabuľka `STANDARD_ENDPOINTS` v `src/standard-api.ts`. Skúška `test/standard-api.test.ts` porovná
riadky tabuľky nižšie s ňou — cesta, ktorá chýba alebo pribudla len na jednej strane, je červená.

**Kedy cesta existuje:**
- **vždy** — každá aplikácia;
- **heslo** — len aplikácia s vlastným prihlásením (`auth: "password"`); pri spustení z NEX Managera
  (`auth: "manager"`) sú používatelia a ich heslá v NEX Manageri a záložka Používatelia v Nastaveniach nie je;
- **AI** — len aplikácia s agentmi (`ai` v manifeste); záložka Agenti v Nastaveniach je len pri nej.

## Cesty

| cesta | kedy | čo robí |
|---|---|---|
| `GET /health` | vždy | Stav aplikácie: `status`, `version`, `checks` (napr. `database`). |
| `GET /auth/me` | vždy | Prihlásený používateľ (rovnaké polia ako riadok používateľa, navyše `must_change_password`). |
| `PATCH /auth/me` | heslo | Moje konto: zmena e-mailu, mena a priezviska vlastného účtu. |
| `POST /auth/change-password` | heslo | Zmena vlastného hesla: `current_password`, `new_password`. |
| `GET /users` | heslo | Zoznam používateľov (len admin). |
| `POST /users` | heslo | Nový používateľ: `username`, `email`, `password`, `role`, `first_name`, `last_name`, `is_active`. |
| `PATCH /users/{id}` | heslo | Úprava používateľa: `email`, `role`, `first_name`, `last_name`, `is_active`. |
| `DELETE /users/{id}` | heslo | Zmazanie používateľa. |
| `POST /users/{id}/password` | heslo | Nové heslo inému používateľovi (admin): `new_password`. |
| `GET /sessions` | vždy | Relácie — kto je prihlásený a odkedy. |
| `DELETE /sessions/{id}` | vždy | Zrušenie relácie (odhlási ju). |
| `GET /system-settings` | vždy | Systémové nastavenia aplikácie: kľúč, hodnota, typ, popis, predvolená hodnota. |
| `PATCH /system-settings/{key}` | vždy | Zmena jedného nastavenia: `value`. |
| `GET /agent-settings` | AI | Model a úsilie pre každú rolu agenta z manifestu. |
| `GET /agent-settings/models` | AI | Modely na výber (rodina — opus, sonnet, haiku —, nikdy verzia). |
| `PUT /agent-settings/{role}` | AI | Uloženie modelu a úsilia pre rolu: `model`, `effort`. |
| `GET /user-layout` | vždy | Rozloženie obrazovky prihláseného používateľa: `sidebar_width`, `sidebar_collapsed` a hranice šírky `limits.sidebar_width` (`min`, `max`, `default`). |
| `PUT /user-layout` | vždy | Uloženie rozloženia; posielajú sa len zmenené polia, šírka `null` = predvolená, šírka mimo hraníc = 422. |
| `GET /release-notes` | vždy | Aktualizácie: zoznam verzií s textom poznámok k vydaniu (`version`, `released_at`, `markdown`). |
| `GET /getting-started` | vždy | Ako začať: návod k aplikácii v tvare Markdown (`markdown`). |

## Roly a oprávnenia

Aplikácia má dve roly: `admin` (Správca) a `user` (Používateľ). Heslo má aspoň 8 znakov (`PASSWORD_MIN_LENGTH`).

- **Používatelia** a nové heslo inému — len `admin`.
- **Systémové nastavenia** vidí každý, mení len `admin`.
- **Agenti** platia pre celú aplikáciu — vidí a mení ich len `admin`.
- **Relácie** — `admin` vidí a ruší všetky, `user` vidí len svoje.
- **Moje konto** a **rozloženie** patria vždy prihlásenému — v ceste nie je id, nikto nečíta ani nemení cudzie.

## Tvar odpovedí

Polia používateľa, relácie a systémového nastavenia sú tie, ktoré zobrazujú panely Nastavení v nex-shared
(`UserRead`, `UserSessionRead`, `SystemSettingRead`); ostatné tvary opisujú typy v `src/standard-api.ts`.
Chyba prichádza v tvare FastAPI `{"detail": "…"}` a text v `detail` je veta pre človeka po slovensky.
