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
| `POST /auth/change-password` | heslo | Zmena vlastného hesla: `new_password` (od v0.17.0 bez súčasného hesla; `current_password` staršieho rámu sa ignoruje). Heslo, ktoré človek má, znovu nevyberie (`KIT-PASSWORD-SAME`). |
| `PUT /auth/language` | heslo | Jazyk prihláseného: `language` (jeden z jazykov aplikácie); vráti prihláseného s jeho jazykom. Spustenej aplikácii jazyk povie NEX Manager. |
| `GET /users` | heslo | Zoznam používateľov (len admin). |
| `POST /users` | heslo | Nový používateľ: `username`, `email`, `password`, `role`, `first_name`, `last_name`, `is_active`, voliteľne `language` (od v0.16.0). |
| `PATCH /users/{id}` | heslo | Úprava používateľa: `email`, `role`, `first_name`, `last_name`, `is_active`, voliteľne `language` (od v0.16.0; bez neho sa jazyk nemení). |
| `DELETE /users/{id}` | heslo | Zmazanie používateľa. Správcu nie, ani seba (`KIT-ADMIN`, od v0.17.0) — najprv mu treba dať inú rolu. |
| `POST /users/{id}/password` | heslo | Nové heslo človeku (admin): `new_password`. Inému je to inicializačné heslo (pri prihlásení si ho zmení); od v0.17.0 aj sebe — vtedy je to riadne heslo, ostatné prehliadače sa prihlásia znovu, tento ostane. |
| `GET /sessions` | vždy | Relácie — kto je prihlásený, odkedy, naposledy aktívny, prehliadač; `current` = táto. |
| `DELETE /sessions/{id}` | vždy | Zrušenie relácie — prestane platiť hneď. |
| `GET /system-settings` | vždy | Systémové nastavenia aplikácie: kľúč, hodnota, typ, popis, predvolená hodnota, ponuka (`choices`). |
| `PATCH /system-settings/{key}` | vždy | Zmena jedného nastavenia: `value`; pri nastavení s ponukou len hodnota z nej. |
| `GET /agent-settings` | AI | Model a úsilie pre každú rolu agenta z manifestu. |
| `GET /agent-settings/models` | AI | Modely na výber (rodina — fable, opus, sonnet, haiku —, nikdy verzia; fable od v0.18.0). |
| `PUT /agent-settings/{role}` | AI | Uloženie modelu a úsilia pre rolu: `model`, `effort`. |
| `GET /user-layout` | vždy | Rozloženie obrazovky prihláseného používateľa: `sidebar_width`, `sidebar_collapsed` a hranice šírky `limits.sidebar_width` (`min`, `max`, `default`). |
| `PUT /user-layout` | vždy | Uloženie rozloženia; posielajú sa len zmenené polia, šírka `null` = predvolená, šírka mimo hraníc = 422. |
| `GET /release-notes` | vždy | Aktualizácie: zoznam verzií s textom poznámok k vydaniu (`version`, `released_at`, `markdown`). |
| `GET /getting-started` | vždy | Ako začať: návod k aplikácii v tvare Markdown (`markdown`). |
| `GET /installation` | vždy | Komu inštalácia slúži: `customer` (meno zákazníka) a `environment` (`uat` / `prod`), obe môžu byť `null`; nastavuje ich kokpit pri nasadení (`NEX_CUSTOMER_NAME`, `NEX_ENVIRONMENT`). DEV-394: aj `languages` (jazyky aplikácie z manifestu) a `language` — jazyk inštalácie pre toho, kto si nevybral (`NEX_LANGUAGE`, ak ho aplikácia má, inak jej hlavný). Aj bez prihlásenia. |
| `GET /installation/manifest.webmanifest` | vždy | Popis nainštalovanej aplikácie pre túto inštaláciu — meno so zákazníkom a pri UAT so značkou UAT. Aj bez prihlásenia. |

## Prihlásenie a relácia

- Relácia je v databáze, jedna na prehliadač. Prehliadač má len cookie `nex_session`, ku ktorej sa JavaScript
  nedostane (HttpOnly, SameSite=Lax, Secure); v databáze je len jej odtlačok (SHA-256).
- Relácia skončí po nečinnosti (`auth_session_idle_minutes`, predvolene 480) a najneskôr po
  `auth_session_max_hours` (predvolene 24) — obe sú systémové nastavenia v kategórii Prihlásenie; ďalej odhlásením,
  zrušením v Reláciách, zmenou hesla (ostatné prehliadače) a novým heslom od správcu (všetky).
- Keď relácia skončí úkonom človeka, aplikácia sa to dozvie (`AppKit(on_account_change=…)`, udalosť `AccountEvent`)
  v tej istej transakcii ako úkon: `signed_out` (odhlásenie), `password_changed` (zmena vlastného hesla),
  `password_set` (nové heslo od správcu), `deactivated` (vypnutie účtu), `session_ended` (zrušenie v Reláciách),
  `deleted` (zmazanie používateľa). Uplynutie času ani to, že NEX Manager človeka už nepotvrdí, úkon nie je;
  zmena roly reláciu neukončí. NEX Manager na šablóne podľa toho odhlási človeka aj v aplikáciách spustených z neho.
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

Aplikácia má dve roly: `admin` (Správca) a `user` (Používateľ). Dĺžku hesla šablóna neobmedzuje — odmietne len prázdne heslo (`KIT-PASSWORD-EMPTY`, `PASSWORD_MIN_LENGTH` = 1); heslo dlhšie ako 72 bajtov sa pred bcryptom zhustí cez SHA-256.

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

## Údaje na viacerých obrazovkách

Údaj zo servera, ktorý ukazuje viac obrazoviek naraz (prihlásený človek, vybraná vec, zoznam, ktorý načíta jedna
obrazovka a mení iná), drží aplikácia na jednom mieste — v spoločnom úložisku (zustand) alebo v ráme. Toto miesto sa
prihlási k zmenám servera (`onServerChange` z nex-shared: klient oznámi každú úspešnú zmenu, jej metódu a cestu) a po
zmene, ktorej sa týka, sa samo obnoví — obrazovka, ktorá údaj mení, nemusí vedieť, kto ho ešte ukazuje. Rám to robí pre
prihláseného človeka (Moje konto, ľavý panel, „Prihlásený ako“). 05.11.2026 NEX Manager: e-mail zmenený
v Používateľoch, Moje konto ukazovalo starý, kým sa stránka neobnovila (DEV-311).

Každé spoločné úložisko sa k zmenám prihlási, alebo v svojom súbore jedným riadkom povie, prečo nemusí — po anglicky,
ako celý kód aplikácie:

- `Copy of server data: none — <čo drží namiesto toho>` (napríklad svetlý či tmavý režim, ktorý žije len v prehliadači);
- `Copy of server data: changed only by this store — <prečo ho žiadna iná obrazovka nemení>`.

Kostra má stráž `src/test/shared-copies.test.ts`: úložisko bez prihlásenia aj bez tohto riadku je chyba skúšok. Stráž
nehádá, ktoré úložisko číta zo servera — jej prvá podoba to hádala a prehliadla úložisko, ktoré načíta údaje cez vlastnú
pomocnú funkciu (DEV-316).

## Dokumenty aplikácie

- Verzia aplikácie: server hlási `APP_VERSION`, ktorú dodá kokpit pri nasadení; bez nej najnovšiu verziu z poznámok
  k vydaniu (`nex_app_kit.docs.newest_version`). Číslo verzie do kódu nezapisuj — prvé PROD premenuje poznámky na 1.0.0
  a zapísané číslo by ostalo staré.
- Aktualizácie: `docs/specs/versions/v<verzia>/RELEASE_NOTES.md`, dátumy v
  `docs/specs/versions/release-dates.json` (`{"v1.4.2": "2026-10-28"}`); úvodný nadpis s verziou sa vynechá.
- Ako začať: `docs/AKO_ZACAT.md` — návod pre človeka, ktorý aplikáciu ešte nevidel.
- Iné jazyky (od v0.16.0, DEV-415): oba dokumenty sú v hlavnom jazyku aplikácie; vedľa nich súbor jazyka —
  `RELEASE_NOTES.hu.md`, `AKO_ZACAT.en.md` — dostane človek, ktorý číta v tom jazyku. Kde chýba, ukáže sa hlavný súbor.

## Jazyk (DEV-394)

- Aplikácia hovorí jazykmi z manifestu (`languages`, hlavný prvý; bez neho len slovenčina) — šablóna pozná `sk`, `hu`
  a od v0.15.0 `en` (DEV-398). Rám šablóny, nex-shared aj server šablóny majú katalógy týchto jazykov; aplikácia pridá svoje texty (`defineApp(data, { messages })`).
- Jazyk človeka: jeho voľba (`kit_users.language`, `PUT /auth/language`; pri spustení z NEX Managera ho povie Manager
  v identite — pole `language`), inak jazyk inštalácie (`NEX_LANGUAGE`), inak hlavný jazyk aplikácie.
- Klient (nex-shared ≥ 0.37.0) pošle jazyk pri každej požiadavke v hlavičke `Accept-Language`; server podľa nej píše
  hlášky (`{"detail": …}`) — ak ten jazyk aplikácia nemá, jazykom inštalácie.
- Vlastné hlášky servera aplikácie (od v0.16.0, DEV-415): katalóg pre každý jazyk aplikácie v `backend/app/locales/<jazyk>.json`
  (kľúče `app.…`, hlavný jazyk je zdroj kľúčov, hodnoty v `{…}` rovnaké vo všetkých jazykoch), načítané
  `load_server_messages` a odovzdané `AppKit(server_messages=…)`. Odmietnutie `KitError(409, "APP-…", "app.server.…",
  params={…})` server povie v jazyku človeka; záznam ostane po slovensky (bez slovenčiny v hlavnom jazyku). Katalóg, ktorý
  nesedí s hlavným, aplikáciu nespustí. Vlastnú výnimku aplikácia preloží `tr(request_language(request), kľúč, hodnoty)`.
- Správca mení jazyk človeka v Nastavenia → Používatelia (od v0.16.0, DEV-415): stĺpec Jazyk a voľba v úprave človeka;
  človek, ktorý si jazyk nevybral, ostáva bez neho a nasleduje jazyk inštalácie.
- Rám nastaví jazyk stránky (`lang` na `<html>`) podľa jazyka, ktorým obrazovky práve hovoria (od v0.16.0).
