# Changelog — nex-app-kit

Rám aplikácií ICC podľa šablóny. Každá verzia zodpovedá jednej značke v gite (`vX.Y.Z`); aplikácie si nex-app-kit
pripínajú na konkrétnu verziu. Značky pri zmenách ako v nex-shared: `[vzhľad]`, `[API]`, `[nové]`, `[oprava]`.

> **Pravidlo:** žiadna nová verzia (zmena `package.json` + značka) bez záznamu v tomto súbore — stráži to CI.

---

## v0.17.0
- `[oprava]` **Správca si v Používateľoch zmení meno aj heslo.** V Orthodox Hermenia správca menil svoje meno, prehliadač
  mu do prázdneho poľa hesla vložil uložené heslo a uloženie skončilo hláškou „Svoje heslo si zmeň v Moje konto.“ Pole
  hesla prehliadač sám nevyplní (nex-shared v0.40.0) a správca smie zmeniť heslo komukoľvek, aj sebe: inému je to
  inicializačné heslo, ktoré si pri prihlásení zmení, sebe riadne heslo — jeho ostatné prehliadače sa prihlásia znovu.
- `[nové]` **Oko pri hesle ukáže, čo človek práve píše.** V Moje konto a pri prvom vlastnom hesle pre každého; v
  Používateľoch len pri vlastnom účte správcu — inému správca len zadá nové inicializačné heslo. Uložené heslo sa
  zobraziť nedá, preto tam oko nie je.
- `[API]` **Moje konto a prvé vlastné heslo sa nepýtajú na súčasné heslo.** `POST /auth/change-password` ho nežiada
  (`current_password` staršieho rámu sa ignoruje); heslo, ktoré človek má, znovu nevyberie.
- `[API]` **Správcu nemožno vymazať, ani seba** (`KIT-ADMIN`). Používatelia mu vymazanie neponúkajú, len zmenu údajov;
  vo vlastnom riadku sa neponúka ani deaktivácia. Kto má odísť, dostane najprv inú rolu (DEV-439).

## v0.16.4
- `[oprava]` **Nová aplikácia dostane overené verzie balíkov.** Kostra šablóny nemala zámok balíkov frontendu, takže
  aplikácia si pri založení brala najnovšie verzie z toho dňa. 18.11.2026 tak dostala Rollup 4.68.6, vydaný v to ráno,
  ktorý v obraze frontendu (node:22-alpine) neprečíta react-dom/client.js — frontend novej aplikácie sa nepostavil a
  CI v0.16.3 bolo červené. Kostra teraz nesie `frontend/package-lock.json` s verziami, s ktorými prešli kontroly
  šablóny (`scaffold/lock.py`, verzie k zvolenému dňu); pri vyplnení sa doplní len nex-app-kit, ostatné verzie ostanú
  — stráži to CI (`scaffold/check_lock.py`). Verzie sa povyšujú vedome pri vydaní šablóny. Nesie aj opravu v0.16.3
  (úprava človeka bez e-mailu) (DEV-428, DEV-422).

## v0.16.3
- `[oprava]` **Správca zmení človeka, ktorý nemá e-mail.** Server šablóny pri každej úprave človeka vyžadoval e-mail, takže
  človeku bez neho (založenému skôr, než bol povinný, alebo NEX Managerom) správca nezmenil jazyk, rolu ani meno, kým mu
  e-mail nedoplnil. Úprava takého človeka e-mail nevyžaduje; zadaný e-mail sa overuje ako doteraz, kto e-mail má, nestratí
  ho, a nový človek ho potrebuje. Formulár Používateľov to dovolí od nex-shared v0.39.1 (DEV-422).

## v0.16.2
- `[oprava]` **Náhľad Vizuálu hovorí názvy nastavení šablóny v jazyku človeka.** Od v0.14.0 nesú nastavenia šablóny
  (odhlásenie po nečinnosti, najdlhšie prihlásenie) kľúče, ktoré do jazyka človeka prekladá server. Náhľad server
  nemá a v Nastavenia → Systém ukazoval holé kľúče (`kit.setting.idle.label`) v každom jazyku. Teraz ich povie z tých
  istých katalógov ako server a rovnako ustúpi: jazyk človeka, hlavný jazyk aplikácie, slovenčina. Skutočná aplikácia
  ich hovorila správne aj predtým (DEV-421).

## v0.16.1
- `[oprava]` **Ako začať v každom jazyku aj v obraze aplikácie.** Server kostry kopíroval do obrazu len
  `docs/AKO_ZACAT.md`, takže `AKO_ZACAT.<jazyk>.md` sa k človeku v inom jazyku nedostal, hoci ho šablóna od v0.16.0
  vie povedať. Kostra teraz kopíruje `AKO_ZACAT*.md`. Aplikácia založená na staršej kostre si riadok v
  `backend/Dockerfile` upraví sama (DEV-418).

## v0.16.0
- `[nové]` **Správca mení jazyk človeka v Používateľoch.** Pri každom človeku je jeho jazyk a v úprave človeka voľba jazyka
  (nex-shared v0.39.0); server ho prijme pri úprave aj založení človeka (`language`) a jazyk, ktorým aplikácia nehovorí,
  odmietne. Človek, ktorý si jazyk nevybral, ďalej nasleduje jazyk inštalácie (DEV-415).
- `[nové]` **Vlastné hlášky servera aplikácie v jazyku človeka.** Aplikácia dá šablóne katalógy svojich viet
  (`backend/app/locales/<jazyk>.json`, `load_server_messages`, `AppKit(server_messages=…)`); odmietnutie s kľúčom `app.…`
  server povie v jazyku, ktorý žiada požiadavka. Katalóg, ktorý nesedí s hlavným jazykom (chýbajúci jazyk či veta, iné
  hodnoty v `{…}`, kľúč mimo `app.`), aplikáciu nespustí. Kostra novej aplikácie má prázdny katalóg pre každý jazyk.
- `[nové]` **Aktualizácie a Ako začať v jazyku človeka.** Vedľa `RELEASE_NOTES.md` a `AKO_ZACAT.md` súbor jazyka
  (`RELEASE_NOTES.hu.md`, `AKO_ZACAT.en.md`); kde chýba, ukáže sa hlavný.
- `[nové]` **Stránka hovorí svojím jazykom.** Rám nastaví `lang` na `<html>` podľa jazyka obrazoviek (aj na prihlásení)
  — prehliadač neponúka preklad zo slovenčiny, čítačka obrazovky číta správnou výslovnosťou.
- Šablóna stojí na nex-shared v0.39.0.

## v0.15.2
- `[oprava]` **Skúška vyplnenej aplikácie prejde aj kontrolou štýlu.** Oprava z v0.15.1 pridala do skúšky aplikácie import
  v poradí, ktoré kontrola štýlu aplikácie (ruff) odmietne — CI novej aplikácie by padlo na štýle. Import je v správnom
  bloku; kontrola štýlu prejde na aplikácii s prihlásením heslom aj cez NEX Manager. Verziu 0.15.1 nepoužívať (DEV-398).

## v0.15.1
- `[oprava]` **Skúška vyplnenej aplikácie čaká hlášku v hlavnom jazyku aplikácie.** Kostra dávala aplikácii skúšku
  servera, ktorá pri spustení bez prepojenia s NEX Managerom čakala slovenskú vetu. Aplikácia s iným hlavným jazykom
  (napríklad maďarčinou) odpovedá — správne — vo svojom hlavnom jazyku, a jej vlastná skúška preto padla hneď po založení.
  Skúška teraz porovná vetu katalógu šablóny v hlavnom jazyku aplikácie. CI šablóny vypĺňa kostru s maďarčinou ako hlavným
  jazykom, takže to odteraz stráži (DEV-398).

## v0.15.0
- `[nové]` **Angličtina ako tretí jazyk šablóny.** Rám (ľavý panel, prihlásenie, Nastavenia, Moje konto, chybové stránky,
  pás UAT), hlášky servera šablóny aj názvy jej nastavení hovoria aj po anglicky (`src/locales/en.ts`,
  `server/src/nex_app_kit/locales/en.json`). Manifest aj kostra poznajú jazyk `en`; nová aplikácia s angličtinou dostane
  aj anglický katalóg svojich textov. Šablóna stojí na nex-shared v0.38.0, ktorá hovorí po anglicky. Aplikácia, ktorá
  angličtinu neponúka, sa nemení (DEV-398).

## v0.14.1
- `[oprava]` **Serverový balík nesie katalógy svojich hlášok.** Vo verzii 0.14.0 chýbali v nainštalovanom balíku súbory
  `locales/sk.json` a `locales/hu.json`, takže server aplikácie na šablóne 0.14.0 sa nespustil (vlastné skúšky balíka
  bežia zo zdrojového stromu a chybu nevideli). Verziu 0.14.0 nepoužívaj — 0.14.1 je tá istá funkcia s úplným balíkom.
  Nová skúška `test_every_file_the_package_reads_is_packaged.py` nepustí súbor balíka, ktorý sa nepribalí. (DEV-394)

## v0.14.0
- `[nové]` **Aplikácia hovorí s každým v jeho jazyku — slovenčina a maďarčina.** Rám šablóny (ľavý panel, horná lišta,
  prihlásenie, zmena hesla, Nastavenia, Ako začať, Aktualizácie, pás UAT, chybové stránky) berie texty z katalógov
  jazykov (`src/locales`, nad katalógmi nex-shared ≥ 0.37.0). Aplikácia v manifeste povie, akými jazykmi hovorí
  (`"languages": ["hu", "sk"]`, hlavný prvý; bez neho len slovenčina) a svoje vlastné texty dá do tých istých katalógov
  (`defineApp(data, { messages })`; položka ľavého panela môže byť kľúč). Každý používateľ si jazyk zvolí v „Moje konto“
  (`PUT /auth/language`, jazyk ostáva pri ňom — `kit_users.language`, migrácia `kit_0003`); kto si nevybral, dostane
  jazyk inštalácie (`NEX_LANGUAGE`, zapisuje ho kokpit), už na prihlásení. Aplikácia spúšťaná z NEX Managera prevezme
  jazyk, ktorý Manager pošle pri spustení. Server píše hlášky v jazyku, ktorý mu klient povie (`Accept-Language`),
  stránka chyby pri spustení v jazyku prehliadača, systémové nastavenia šablóny tiež. Text, ktorý aplikácia nepreloží
  do všetkých svojich jazykov, ju zastaví pri štarte s menom textu a jazyka. Nový príkaz `nex-check-texts src`
  (a `nex-app-kit/check-texts`) nájde text napísaný natvrdo mimo katalógu; kostra ho púšťa vo svojich skúškach
  v aplikácii s viacerými jazykmi. Aplikácia, ktorá hovorí len po slovensky, sa správa ako doteraz. (DEV-394)

## v0.13.0
- `[nové]` **Aplikácia ukáže, komu inštalácia slúži.** Kokpit (od 4.138.0) pri každom nasadení zapíše backendu
  inštalácie meno zákazníka a prostredie (`NEX_CUSTOMER_NAME`, `NEX_ENVIRONMENT`) a rám ich ukáže: názov okna
  „<aplikácia> — <zákazník> (UAT)“, meno zákazníka hore v ľavom paneli aj na karte prihlásenia, a UAT dostane nad každou
  stránkou výrazný pás „Skúšobné prostredie (UAT) — <zákazník>“ (na karte prihlásenia značku), aby sa skúšobná
  inštalácia nezamenila s ostrou. Nainštalovaná aplikácia sa pomenuje tými istými slovami — server vydá jej popis pre
  túto inštaláciu (`GET /installation/manifest.webmanifest`) a rám naň presmeruje odkaz v hlavičke stránky, takže ikona
  na ploche, lišta aj Alt+Tab povedia, čia je. Nové cesty `GET /installation` a `GET /installation/manifest.webmanifest`
  (vždy, aj bez prihlásenia). Aplikácia nemusí nič meniť okrem verzie šablóny; mimo kokpitu vyzerá ako doteraz.
  (DEV-377)

## v0.12.0
- `[nové]` **Prehľad len pre niektorých.** Aplikácia môže položku Prehľad v ľavom paneli skryť pred ľuďmi, ktorí ju
  nemajú vidieť — tým istým spôsobom ako svoje položky: `defineApp(data, { visible: { "/": useSeesOverview } })`.
  Prehľad sa ukáže, len keď háčik povie áno; kým to nevie, je skrytý. Kto Prehľad nevidí, nedostane ho ani ako prvú
  obrazovku: rám ho pošle na prvú vlastnú položku aplikácie, ktorú vidí (bez vlastnej podmienky, správcovská len
  správcovi), inak na Ako začať. Aplikácia bez podmienky sa správa ako doteraz. Údaje Prehľadu musí aplikácia aj tak
  chrániť na svojom serveri. Prvé použitie: NEX Finance, kde Operátor Prehľad pre vedenie nevidí. (DEV-368)

## v0.11.2
- `[oprava]` **Stráž spoločných úložísk nehádá.** Stráž kostry `src/test/shared-copies.test.ts` (`sharedCopies.ts`)
  hľadala úložiská, ktoré načítajú údaje zo servera, podľa spôsobu načítania — a úložisko, ktoré načíta cez vlastnú
  pomocnú funkciu, prehliadla. Teraz platí ako v kokpite: každé spoločné úložisko (zustand, aj `zustand/vanilla`
  s `createStore`) sa prihlási k zmenám servera (`onServerChange`), alebo v svojom súbore jedným riadkom povie, prečo
  nemusí — `Copy of server data: none — …` či `Copy of server data: changed only by this store — …` (KONTRAKT.md,
  „Údaje na viacerých obrazovkách“). Funkcia stráže sa volá `storesThatDoNotFollowTheServer`; aplikácia, ktorá má kópiu
  stráže, prevezme oba súbory zo šablóny a úložiskám bez prihlásenia dopíše riadok s dôvodom. (DEV-316)

## v0.11.1
- `[oprava]` **Kód z kostry je celý po anglicky.** Poznámky, docstringy a mená skúšok, ktoré kostra zapíše do každej
  aplikácie, boli na 75 riadkoch po slovensky (nginx.conf, náhľad „Vizuál“, `index.html`, `icon.svg`, stráž
  `shared-copies.test.ts` …) a kontrola jazyka kokpitu ich chytila až vtedy, keď ich agent skopíroval: 05.11.2026 stála
  na nich rýchla oprava NEX Managera 1.5.4. Text, ktorý aplikácia ukazuje človeku, ostáva po slovensky; meno obrazovky
  či citát stojí v úvodzovkách na jednom riadku, meno aplikácie v komentári `docker-compose.yml` tiež. Nová skúška
  `scaffold/tests/test_language.py` vyplní kostru ako kokpit (pre obe prihlásenia) a zlyhá na slovenskej poznámke
  v ktoromkoľvek súbore; súbor druhu, ktorý nevie čítať, je tiež chyba. (DEV-313)

## v0.11.0
- `[nové]` **Zmena prihláseného človeka sa ukáže všade naraz.** Rám sa prihlási k zmenám servera (`onServerChange`
  z nex-shared v0.33.0) a po každej zmene prihláseného človeka — v Moje konto, v Používateľoch alebo na vlastnej
  obrazovke aplikácie — obnoví Moje konto, ľavý panel aj „Prihlásený ako“ bez obnovenia stránky; panel Moje konto
  sleduje aktuálne údaje. 05.11.2026 NEX Manager: e-mail zmenený v Používateľoch, Moje konto ukazovalo starý. (DEV-311)
- `[nové]` **Pravidlo a stráž pre každú aplikáciu.** KONTRAKT.md, „Údaje na viacerých obrazovkách“: spoločné úložisko,
  ktoré načíta údaje zo servera, sa prihlási k zmenám a obnoví sa samo. Kostra nesie stráž
  `src/test/shared-copies.test.ts` (`sharedCopies.ts`): úložisko bez prihlásenia je chyba skúšok. Director 05.11.2026:
  „… prosím raz a navždy zabezpečiť, aby nič také už viackrát sa nestalo ani v kokpite ani v našich aplikáciách.“
- `[API]` Šablóna a kostra stoja na nex-shared v0.33.0.

## v0.10.0
- `[API]` **Jeden e-mail pri viacerých účtoch.** E-mail človeka už nie je jedinečný: migrácia `kit_0002` zruší obmedzenie
  `uq_kit_users_email` a odmietnutie `KIT-EMAIL-TAKEN` („Tento e-mail už používa iný používateľ.“) zaniklo v Moje konto aj
  v Používateľoch. Prihlasovacie meno ostáva jedinečné. Kto má dva účty (napríklad správcu a bežný), má pri oboch svoj
  e-mail — aj v aplikácii spustenej z NEX Managera, ktorá e-mail preberá. Pravidlo jedinečnosti nikto nezadal: prišlo
  z prvého návrhu NEX Managera (jún 2026) a šablóna ho prevzala. Director 05.11.2026: „chcem aby emailová adresa bola
  moja pri obidvoch.“ (DEV-310)

## v0.9.1
- `[oprava]` **„Moje konto“ povie, prečo server odmietol.** Šablóna a kostra stoja na nex-shared v0.32.0: keď server
  uloženie údajov alebo zmenu hesla odmietne vlastnou vetou („Tento e-mail už používa iný používateľ.“, „Súčasné heslo
  je nesprávne.“), panel ju ukáže namiesto „Uloženie zlyhalo. Skús to znova.“ 05.11.2026 to v NEX Manageri 1.5.1
  zatajilo, že zadaný e-mail má iný účet. Bez vety servera ostáva všeobecná veta. (DEV-309)

## v0.9.0
- `[nové]` **Verzia aplikácie z poznámok k vydaniu.** `nex_app_kit.docs.newest_version(docs_dir)` vráti najnovšiu
  verziu, ktorá má poznámky (`v1.2.0/RELEASE_NOTES.md` → `1.2.0`). Kostra (`scaffold/nsv-standard`) berie verziu servera
  z `APP_VERSION`, ktorú dodá kokpit pri nasadení, inak z najnovších poznámok — už nie z čísla v kóde; predpis služieb
  nechá `APP_VERSION` prázdne. Prvé PROD, ktoré poznámky premenuje na 1.0.0, tak nemá v aplikácii čo hľadať a meniť.
  04.11.2026 mala NEX Knowledge „0.2.1“ zapísané na piatich miestach a po premenovaní na 1.0.0 jej hlavná vetva
  sčervenala. (DEV-307)

## v0.8.0
- `[API]` **Heslo bez obmedzenia dĺžky.** Server odmietne len prázdne heslo (`KIT-PASSWORD-EMPTY`); kódy
  `KIT-PASSWORD-SHORT` a `KIT-PASSWORD-LONG` zanikli. Heslo dlhšie ako 72 bajtov (najviac, čo bcrypt číta) sa pred
  bcryptom zhustí cez SHA-256, takže sa ráta celé; kratšie ide do bcryptu ako doteraz, odtlačky z NEX Managera a kokpitu
  platia ďalej. `PASSWORD_MIN_LENGTH` = 1 na serveri aj vo frontende, obrazovka zmeny hesla nepíše „aspoň 8 znakov“.
  Pravidlo Directora: „Dĺžku, zložitosť ani tvar hesla neobmedzujem a nenavrhujem — o hesle rozhoduje Director; nástroj
  odmietne nanajvýš prázdne heslo.“ (DEV-296)
- `[API]` Šablóna a kostra stoja na nex-shared v0.31.0.

## v0.7.0
- `[nové]` **Tlačidlo aplikácie v riadku človeka v Nastaveniach → Používatelia** (`defineApp(data, { userActions })`).
  Všetko o ľuďoch ostáva v tejto jednej záložke: NEX Manager z nej otvorí okno „Prístupy“ (skupiny, aplikácie a história
  človeka) namiesto druhej obrazovky s ľuďmi v ľavom paneli. Čo uvidí ten, kto ľudí spravovať nesmie, rozhodne aplikácia.
  Director 03.11.2026: „Všetko má byť len v nastaveniach v záložke používatelia.“ (DEV-293)
- `[API]` Šablóna stojí na nex-shared v0.30.0 (`UsersPanel rowActions`); kostra tiež.

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
