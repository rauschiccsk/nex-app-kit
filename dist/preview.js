import {
  STANDARD_ENDPOINTS
} from "./chunk-33ECZEVM.js";

// src/preview.ts
import { HttpResponse, http } from "msw";

// server/src/nex_app_kit/kit_settings.json
var kit_settings_default = [
  {
    key: "auth_session_idle_minutes",
    default: "480",
    value_type: "int",
    label: "kit.setting.idle.label",
    description: "kit.setting.idle.description",
    unit: "kit.setting.idle.unit",
    min: 5,
    max: 1440
  },
  {
    key: "auth_session_max_hours",
    default: "24",
    value_type: "int",
    label: "kit.setting.maxHours.label",
    description: "kit.setting.maxHours.description",
    unit: "kit.setting.maxHours.unit",
    min: 1,
    max: 720
  }
];

// server/src/nex_app_kit/locales/en.json
var en_default = {
  "kit.server.accountInactive": "This account is switched off. Contact the app's administrator.",
  "kit.server.adminDelete": "An administrator cannot be deleted \u2014 you can change their details.",
  "kit.server.adminOnly": "Only the app's administrator may do this.",
  "kit.server.agentRoleUnknown": "The app has no agent role \u201C{role}\u201D.",
  "kit.server.emailInvalid": "\u201C{email}\u201D is not a valid e-mail.",
  "kit.server.emailRequired": "E-mail is required.",
  "kit.server.field.firstName": "First name",
  "kit.server.field.lastName": "Last name",
  "kit.server.forbidden": "You are not allowed to do this.",
  "kit.server.languageUnknown": "The app has no language \u201C{language}\u201D \u2014 it has these: {languages}.",
  "kit.server.launch.expired": "The launch ticket is no longer valid. Open the app again from NEX Manager.",
  "kit.server.launch.inactive": "Your account in NEX Manager is switched off.",
  "kit.server.launch.invalid": "The launch ticket is not valid. Open the app again from NEX Manager.",
  "kit.server.launch.managerDown": "NEX Manager does not answer right now. Try opening the app again in a moment.",
  "kit.server.launch.missing": "The launch ticket is missing. Open the app from NEX Manager.",
  "kit.server.launch.noAccess": "You have no access to this app in NEX Manager.",
  "kit.server.launch.noAccessAnswer": "NEX Manager did not say whether you have access to this app \u2014 a newer version of NEX Manager is needed.",
  "kit.server.launch.notLaunch": "The ticket is not for launching the app.",
  "kit.server.launch.notLinked": "The app is not linked to NEX Manager yet. Tell the app's administrator.",
  "kit.server.launch.otherCustomer": "The ticket was issued by another customer's NEX Manager.",
  "kit.server.launch.pageHeading": "The app could not be opened",
  "kit.server.launch.pageTitle": "Launching the app",
  "kit.server.launch.password": "First change your password in NEX Manager.",
  "kit.server.launch.tooLong": "The launch ticket is valid for too long \u2014 NEX Manager does not issue such tickets.",
  "kit.server.launch.unknown": "NEX Manager does not know this person.",
  "kit.server.launch.used": "This launch ticket has already been used. Open the app again from NEX Manager.",
  "kit.server.layoutWidth": "The left panel must be from {min} to {max} px wide.",
  "kit.server.locked": "Too many wrong attempts. Try again in {minutes} min.",
  "kit.server.managerExpired": "The sign-in has expired. Open the app again from NEX Manager.",
  "kit.server.nameTooLong": "{what} may have at most {max} characters.",
  "kit.server.notSignedIn": "You are not signed in.",
  "kit.server.origin": "The request did not come from this app \u2014 refused.",
  "kit.server.passwordChangeFirst": "First change your password.",
  "kit.server.passwordEmpty": "The password must not be empty.",
  "kit.server.passwordSame": "The new password must differ from the current one.",
  "kit.server.roleInvalid": "The role is \u201Cadmin\u201D (administrator) or \u201Cuser\u201D, not \u201C{role}\u201D.",
  "kit.server.selfRole": "You cannot change your own role or switch off your own account \u2014 another administrator will do it.",
  "kit.server.sessionUnknown": "There is no such session \u2014 perhaps it has already ended.",
  "kit.server.setting.choice": "\u201C{label}\u201D must be one of the choices \u2014 \u201C{value}\u201D is not among them.",
  "kit.server.setting.choicesDown": "The choices for \u201C{label}\u201D cannot be loaded now \u2014 try again in a moment.",
  "kit.server.setting.empty": "\u201C{label}\u201D must not be empty.",
  "kit.server.setting.integer": "\u201C{label}\u201D must be a whole number, not \u201C{value}\u201D.",
  "kit.server.setting.number": "\u201C{label}\u201D must be a number, not \u201C{value}\u201D.",
  "kit.server.setting.range": "\u201C{label}\u201D must be from {min} to {max}.",
  "kit.server.setting.unknown": "The app has no system setting \u201C{key}\u201D.",
  "kit.server.setting.yesNo": "\u201C{label}\u201D is yes or no, not \u201C{value}\u201D.",
  "kit.server.userHasRecords": "The user cannot be deleted \u2014 the app has records that belong to them. Switch them off instead.",
  "kit.server.userUnknown": "There is no such user.",
  "kit.server.usernameInvalid": "A username has 3 to 50 characters: letters without diacritics, digits, a dot, a hyphen, an underscore or an at sign.",
  "kit.server.usernameTaken": "Another user already has the username \u201C{username}\u201D.",
  "kit.server.wrongCredentials": "Wrong username or password.",
  "kit.setting.idle.description": "After how many minutes without work the app signs a person out.",
  "kit.setting.idle.label": "Sign-out after inactivity",
  "kit.setting.idle.unit": "minutes",
  "kit.setting.maxHours.description": "After how many hours at most a person must sign in again, even while working.",
  "kit.setting.maxHours.label": "Longest sign-in",
  "kit.setting.maxHours.unit": "hours"
};

// server/src/nex_app_kit/locales/hu.json
var hu_default = {
  "kit.server.accountInactive": "Ez a fi\xF3k ki van kapcsolva. Fordulj az alkalmaz\xE1s rendszergazd\xE1j\xE1hoz.",
  "kit.server.adminDelete": "Rendszergazda nem t\xF6r\xF6lhet\u0151 \u2014 az adatait m\xF3dos\xEDthatod.",
  "kit.server.adminOnly": "Ezt csak az alkalmaz\xE1s rendszergazd\xE1ja teheti meg.",
  "kit.server.agentRoleUnknown": "Az alkalmaz\xE1snak nincs \u201E{role}\u201C \xFCgyn\xF6k-szerepk\xF6re.",
  "kit.server.emailInvalid": "\u201E{email}\u201C nem \xE9rv\xE9nyes e-mail-c\xEDm.",
  "kit.server.emailRequired": "Az e-mail-c\xEDm megad\xE1sa k\xF6telez\u0151.",
  "kit.server.field.firstName": "Keresztn\xE9v",
  "kit.server.field.lastName": "Vezet\xE9kn\xE9v",
  "kit.server.forbidden": "Ehhez a m\u0171velethez nincs jogosults\xE1god.",
  "kit.server.languageUnknown": "Az alkalmaz\xE1snak nincs \u201E{language}\u201C nyelve \u2014 ezek vannak: {languages}.",
  "kit.server.launch.expired": "Az ind\xEDt\xF3jegy m\xE1r nem \xE9rv\xE9nyes. Nyisd meg \xFAjra az alkalmaz\xE1st a NEX Managerb\u0151l.",
  "kit.server.launch.inactive": "A fi\xF3kod a NEX Managerben ki van kapcsolva.",
  "kit.server.launch.invalid": "Az ind\xEDt\xF3jegy nem \xE9rv\xE9nyes. Nyisd meg \xFAjra az alkalmaz\xE1st a NEX Managerb\u0151l.",
  "kit.server.launch.managerDown": "A NEX Manager most nem v\xE1laszol. Pr\xF3b\xE1ld meg egy kicsit k\xE9s\u0151bb megnyitni az alkalmaz\xE1st.",
  "kit.server.launch.missing": "Hi\xE1nyzik az ind\xEDt\xF3jegy. Nyisd meg az alkalmaz\xE1st a NEX Managerb\u0151l.",
  "kit.server.launch.noAccess": "A NEX Managerben nincs hozz\xE1f\xE9r\xE9sed ehhez az alkalmaz\xE1shoz.",
  "kit.server.launch.noAccessAnswer": "A NEX Manager nem mondta meg, van-e hozz\xE1f\xE9r\xE9sed ehhez az alkalmaz\xE1shoz \u2014 a NEX Manager \xFAjabb verzi\xF3ja kell.",
  "kit.server.launch.notLaunch": "A jegy nem az alkalmaz\xE1s ind\xEDt\xE1s\xE1ra sz\xF3l.",
  "kit.server.launch.notLinked": "Az alkalmaz\xE1s m\xE9g nincs \xF6sszekapcsolva a NEX Managerrel. Sz\xF3lj az alkalmaz\xE1s rendszergazd\xE1j\xE1nak.",
  "kit.server.launch.otherCustomer": "A jegyet egy m\xE1sik \xFCgyf\xE9l NEX Managere adta ki.",
  "kit.server.launch.pageHeading": "Az alkalmaz\xE1st nem siker\xFClt megnyitni",
  "kit.server.launch.pageTitle": "Az alkalmaz\xE1s ind\xEDt\xE1sa",
  "kit.server.launch.password": "El\u0151bb m\xF3dos\xEDtsd a jelszavadat a NEX Managerben.",
  "kit.server.launch.tooLong": "Az ind\xEDt\xF3jegy t\xFAl sok\xE1ig \xE9rv\xE9nyes \u2014 ilyet a NEX Manager nem ad ki.",
  "kit.server.launch.unknown": "A NEX Manager nem ismeri ezt a szem\xE9lyt.",
  "kit.server.launch.used": "Ezt az ind\xEDt\xF3jegyet m\xE1r felhaszn\xE1lt\xE1k. Nyisd meg \xFAjra az alkalmaz\xE1st a NEX Managerb\u0151l.",
  "kit.server.layoutWidth": "A bal oldali panel sz\xE9less\xE9ge {min} \xE9s {max} px k\xF6z\xF6tt lehet.",
  "kit.server.locked": "T\xFAl sok sikertelen pr\xF3b\xE1lkoz\xE1s. Pr\xF3b\xE1ld \xFAjra {minutes} perc m\xFAlva.",
  "kit.server.managerExpired": "A bejelentkez\xE9s lej\xE1rt. Nyisd meg \xFAjra az alkalmaz\xE1st a NEX Managerb\u0151l.",
  "kit.server.nameTooLong": "A(z) {what} legfeljebb {max} karakter lehet.",
  "kit.server.notSignedIn": "Nem vagy bejelentkezve.",
  "kit.server.origin": "A k\xE9r\xE9s nem ebb\u0151l az alkalmaz\xE1sb\xF3l \xE9rkezett \u2014 elutas\xEDtva.",
  "kit.server.passwordChangeFirst": "El\u0151bb m\xF3dos\xEDtsd a jelszavadat.",
  "kit.server.passwordEmpty": "A jelsz\xF3 nem lehet \xFCres.",
  "kit.server.passwordSame": "Az \xFAj jelsz\xF3nak k\xFCl\xF6nb\xF6znie kell a jelenlegit\u0151l.",
  "kit.server.roleInvalid": "A szerepk\xF6r \u201Eadmin\u201C (rendszergazda) vagy \u201Euser\u201C (felhaszn\xE1l\xF3) lehet, nem \u201E{role}\u201C.",
  "kit.server.selfRole": "A saj\xE1t szerepk\xF6r\xF6det nem m\xF3dos\xEDthatod, \xE9s a saj\xE1t fi\xF3kodat nem kapcsolhatod ki \u2014 ezt egy m\xE1sik rendszergazda teheti meg.",
  "kit.server.sessionUnknown": "Nincs ilyen munkamenet \u2014 lehet, hogy m\xE1r v\xE9get \xE9rt.",
  "kit.server.setting.choice": "\u201E{label}\u201C \xE9rt\xE9ke csak a v\xE1laszt\xE9kb\xF3l lehet \u2014 \u201E{value}\u201C nincs benne.",
  "kit.server.setting.choicesDown": "\u201E{label}\u201C v\xE1laszt\xE9ka most nem t\xF6lthet\u0151 be \u2014 pr\xF3b\xE1ld \xFAjra egy kicsit k\xE9s\u0151bb.",
  "kit.server.setting.empty": "\u201E{label}\u201C nem lehet \xFCres.",
  "kit.server.setting.integer": "\u201E{label}\u201C eg\xE9sz sz\xE1m kell legyen, nem \u201E{value}\u201C.",
  "kit.server.setting.number": "\u201E{label}\u201C sz\xE1m kell legyen, nem \u201E{value}\u201C.",
  "kit.server.setting.range": "\u201E{label}\u201C \xE9rt\xE9ke {min} \xE9s {max} k\xF6z\xF6tt lehet.",
  "kit.server.setting.unknown": "Az alkalmaz\xE1snak nincs \u201E{key}\u201C rendszerbe\xE1ll\xEDt\xE1sa.",
  "kit.server.setting.yesNo": "\u201E{label}\u201C \xE9rt\xE9ke igen vagy nem lehet, nem \u201E{value}\u201C.",
  "kit.server.userHasRecords": "A felhaszn\xE1l\xF3 nem t\xF6r\xF6lhet\u0151 \u2014 az alkalmaz\xE1sban vannak hozz\xE1 tartoz\xF3 adatok. Kapcsold ki ink\xE1bb.",
  "kit.server.userUnknown": "Nincs ilyen felhaszn\xE1l\xF3.",
  "kit.server.usernameInvalid": "A felhaszn\xE1l\xF3n\xE9v 3\u201350 karakter: \xE9kezet n\xE9lk\xFCli bet\u0171k, sz\xE1mjegyek, pont, k\xF6t\u0151jel, al\xE1h\xFAz\xE1s vagy kukac.",
  "kit.server.usernameTaken": "A(z) \u201E{username}\u201C felhaszn\xE1l\xF3n\xE9v m\xE1r egy m\xE1sik felhaszn\xE1l\xF3\xE9.",
  "kit.server.wrongCredentials": "Hib\xE1s felhaszn\xE1l\xF3n\xE9v vagy jelsz\xF3.",
  "kit.setting.idle.description": "H\xE1ny perc t\xE9tlens\xE9g ut\xE1n jelentkezteti ki az alkalmaz\xE1s a felhaszn\xE1l\xF3t.",
  "kit.setting.idle.label": "Kijelentkez\xE9s t\xE9tlens\xE9g ut\xE1n",
  "kit.setting.idle.unit": "perc",
  "kit.setting.maxHours.description": "Legk\xE9s\u0151bb h\xE1ny \xF3ra ut\xE1n kell \xFAjra bejelentkezni, akkor is, ha a felhaszn\xE1l\xF3 dolgozik.",
  "kit.setting.maxHours.label": "Leghosszabb bejelentkez\xE9s",
  "kit.setting.maxHours.unit": "\xF3ra"
};

// server/src/nex_app_kit/locales/sk.json
var sk_default = {
  "kit.server.accountInactive": "Tento \xFA\u010Det je vypnut\xFD. Obr\xE1\u0165 sa na spr\xE1vcu aplik\xE1cie.",
  "kit.server.adminDelete": "Spr\xE1vcu nemo\u017Eno vymaza\u0165 \u2014 m\xF4\u017Ee\u0161 zmeni\u0165 jeho \xFAdaje.",
  "kit.server.adminOnly": "Toto smie len spr\xE1vca aplik\xE1cie.",
  "kit.server.agentRoleUnknown": "Rolu agenta \u201E{role}\u201C aplik\xE1cia nem\xE1.",
  "kit.server.emailInvalid": "\u201E{email}\u201C nie je platn\xFD e-mail.",
  "kit.server.emailRequired": "E-mail je povinn\xFD.",
  "kit.server.field.firstName": "Meno",
  "kit.server.field.lastName": "Priezvisko",
  "kit.server.forbidden": "Na t\xFAto akciu nem\xE1\u0161 opr\xE1vnenie.",
  "kit.server.languageUnknown": "Jazyk \u201E{language}\u201C aplik\xE1cia nem\xE1 \u2014 m\xE1 tieto: {languages}.",
  "kit.server.launch.expired": "L\xEDstok na spustenie u\u017E neplat\xED. Otvor aplik\xE1ciu znova z NEX Managera.",
  "kit.server.launch.inactive": "Tvoj \xFA\u010Det v NEX Manageri je vypnut\xFD.",
  "kit.server.launch.invalid": "L\xEDstok na spustenie nie je platn\xFD. Otvor aplik\xE1ciu znova z NEX Managera.",
  "kit.server.launch.managerDown": "NEX Manager teraz neodpoved\xE1. Sk\xFAs aplik\xE1ciu otvori\u0165 o chv\xED\u013Eu znova.",
  "kit.server.launch.missing": "Ch\xFDba l\xEDstok na spustenie. Otvor aplik\xE1ciu z NEX Managera.",
  "kit.server.launch.noAccess": "K tejto aplik\xE1cii nem\xE1\u0161 v NEX Manageri pr\xEDstup.",
  "kit.server.launch.noAccessAnswer": "NEX Manager nepovedal, \u010Di m\xE1\u0161 k tejto aplik\xE1cii pr\xEDstup \u2014 treba nov\u0161iu verziu NEX Managera.",
  "kit.server.launch.notLaunch": "L\xEDstok nie je na spustenie aplik\xE1cie.",
  "kit.server.launch.notLinked": "Aplik\xE1cia e\u0161te nie je prepojen\xE1 s NEX Managerom. Povedz o tom spr\xE1vcovi aplik\xE1cie.",
  "kit.server.launch.otherCustomer": "L\xEDstok vydal NEX Manager in\xE9ho z\xE1kazn\xEDka.",
  "kit.server.launch.pageHeading": "Aplik\xE1ciu sa nepodarilo otvori\u0165",
  "kit.server.launch.pageTitle": "Spustenie aplik\xE1cie",
  "kit.server.launch.password": "Najprv si zme\u0148 heslo v NEX Manageri.",
  "kit.server.launch.tooLong": "L\xEDstok na spustenie plat\xED pr\xEDli\u0161 dlho \u2014 tak\xFD NEX Manager nevyd\xE1va.",
  "kit.server.launch.unknown": "NEX Manager t\xFAto osobu nepozn\xE1.",
  "kit.server.launch.used": "Tento l\xEDstok na spustenie u\u017E bol pou\u017Eit\xFD. Otvor aplik\xE1ciu znova z NEX Managera.",
  "kit.server.layoutWidth": "\u0160\xEDrka \u013Eav\xE9ho panela mus\xED by\u0165 od {min} do {max} px.",
  "kit.server.locked": "Pr\xEDli\u0161 ve\u013Ea nespr\xE1vnych pokusov. Sk\xFAs to znova o {minutes} min.",
  "kit.server.managerExpired": "Prihl\xE1senie vypr\u0161alo. Aplik\xE1ciu otvor znova z NEX Managera.",
  "kit.server.nameTooLong": "{what} m\xF4\u017Ee ma\u0165 najviac {max} znakov.",
  "kit.server.notSignedIn": "Nie si prihl\xE1sen\xFD.",
  "kit.server.origin": "Po\u017Eiadavka nepri\u0161la z tejto aplik\xE1cie \u2014 odmietnut\xE1.",
  "kit.server.passwordChangeFirst": "Najprv si zme\u0148 heslo.",
  "kit.server.passwordEmpty": "Heslo nesmie by\u0165 pr\xE1zdne.",
  "kit.server.passwordSame": "Nov\xE9 heslo mus\xED by\u0165 in\xE9 ako s\xFA\u010Dasn\xE9.",
  "kit.server.roleInvalid": "Rola je \u201Eadmin\u201C (spr\xE1vca) alebo \u201Euser\u201C (pou\u017E\xEDvate\u013E), nie \u201E{role}\u201C.",
  "kit.server.selfRole": "Vlastn\xFA rolu si nezmen\xED\u0161 a vlastn\xFD \xFA\u010Det nevypne\u0161 \u2014 urob\xED to in\xFD spr\xE1vca.",
  "kit.server.sessionUnknown": "Tak\xE1 rel\xE1cia nie je \u2014 mo\u017Eno u\u017E skon\u010Dila.",
  "kit.server.setting.choice": "\u201E{label}\u201C mus\xED by\u0165 z ponuky \u2014 \u201E{value}\u201C v nej nie je.",
  "kit.server.setting.choicesDown": "Ponuka pre \u201E{label}\u201C sa teraz ned\xE1 na\u010D\xEDta\u0165 \u2014 sk\xFAs to o chv\xED\u013Eu.",
  "kit.server.setting.empty": "\u201E{label}\u201C nesmie by\u0165 pr\xE1zdne.",
  "kit.server.setting.integer": "\u201E{label}\u201C mus\xED by\u0165 cel\xE9 \u010D\xEDslo, nie \u201E{value}\u201C.",
  "kit.server.setting.number": "\u201E{label}\u201C mus\xED by\u0165 \u010D\xEDslo, nie \u201E{value}\u201C.",
  "kit.server.setting.range": "\u201E{label}\u201C mus\xED by\u0165 od {min} do {max}.",
  "kit.server.setting.unknown": "Syst\xE9mov\xE9 nastavenie \u201E{key}\u201C aplik\xE1cia nem\xE1.",
  "kit.server.setting.yesNo": "\u201E{label}\u201C je \xE1no alebo nie, nie \u201E{value}\u201C.",
  "kit.server.userHasRecords": "Pou\u017E\xEDvate\u013Ea nejde zmaza\u0165 \u2014 aplik\xE1cia m\xE1 z\xE1znamy, ktor\xE9 k nemu patria. Vypni ho namiesto toho.",
  "kit.server.userUnknown": "Tak\xFD pou\u017E\xEDvate\u013E nie je.",
  "kit.server.usernameInvalid": "Prihlasovacie meno m\xE1 3 a\u017E 50 znakov: p\xEDsmen\xE1 bez diakritiky, \u010D\xEDslice, bodku, poml\u010Dku, pod\u010Diarkovn\xEDk alebo zavin\xE1\u010D.",
  "kit.server.usernameTaken": "Prihlasovacie meno \u201E{username}\u201C u\u017E m\xE1 in\xFD pou\u017E\xEDvate\u013E.",
  "kit.server.wrongCredentials": "Nespr\xE1vne meno alebo heslo.",
  "kit.setting.idle.description": "Po ko\u013Ek\xFDch min\xFAtach bez pr\xE1ce aplik\xE1cia \u010Dloveka odhl\xE1si.",
  "kit.setting.idle.label": "Odhl\xE1senie po ne\u010Dinnosti",
  "kit.setting.idle.unit": "min\xFAt",
  "kit.setting.maxHours.description": "Najnesk\xF4r po ko\u013Ek\xFDch hodin\xE1ch sa treba prihl\xE1si\u0165 znova, aj ke\u010F \u010Dlovek pracuje.",
  "kit.setting.maxHours.label": "Najdlh\u0161ie prihl\xE1senie",
  "kit.setting.maxHours.unit": "hod\xEDn"
};

// src/preview.ts
var NOW = "2026-01-01T08:00:00Z";
var KIT_SETTINGS = kit_settings_default.map((d) => ({
  key: d.key,
  value: d.default,
  value_type: d.value_type,
  label: d.label,
  description: d.description,
  unit: d.unit,
  updated_at: null,
  updated_by: null,
  updated_by_username: null,
  is_default: true
}));
var SERVER_CATALOGS = {
  sk: sk_default,
  hu: hu_default,
  en: en_default
};
function saidAs(text, language, main) {
  if (!text) return text;
  for (const code of [language, main, "sk"]) {
    const said = code ? SERVER_CATALOGS[code]?.[text] : void 0;
    if (said) return said;
  }
  return text;
}
function json(data, status = 200) {
  return HttpResponse.json(data, { status });
}
function noContent() {
  return new HttpResponse(null, { status: 204 });
}
function previewHandlers(options) {
  const { manifest } = options;
  let me = {
    id: "nahlad-spravca",
    username: "spravca",
    email: "spravca@priklad.sk",
    role: "admin",
    is_active: true,
    first_name: "Uk\xE1\u017Ekov\xFD",
    last_name: "spr\xE1vca",
    created_at: NOW,
    updated_at: NOW,
    ...options.user,
    must_change_password: false
  };
  const colleague = {
    id: "nahlad-pouzivatel",
    username: "pouzivatel",
    email: "pouzivatel@priklad.sk",
    role: "user",
    is_active: true,
    first_name: "Uk\xE1\u017Ekov\xFD",
    last_name: "pou\u017E\xEDvate\u013E",
    created_at: NOW,
    updated_at: NOW
  };
  const person = (u) => ({
    email: `${u.username}@priklad.sk`,
    role: "user",
    is_active: true,
    first_name: null,
    last_name: null,
    created_at: NOW,
    ...u,
    updated_at: u.updated_at ?? u.created_at ?? NOW
  });
  const listed = options.users?.map((u) => u.id === me.id ? me : person(u));
  const people = !listed ? [me, colleague] : listed.some((u) => u.id === me.id) ? listed : [me, ...listed];
  const session = {
    id: "nahlad-relacia",
    user_id: me.id,
    username: me.username,
    created_at: NOW,
    last_seen_at: NOW,
    updated_at: NOW,
    expires_at: "2026-01-02T08:00:00Z",
    user_agent: "N\xE1h\u013Ead Vizu\xE1lu",
    current: true
  };
  const settings = [...KIT_SETTINGS, ...options.settings ?? []];
  const main = manifest.languages?.[0] ?? "sk";
  const saidIn = (row) => ({
    ...row,
    label: saidAs(row.label, me.language, main),
    description: saidAs(row.description, me.language, main),
    unit: saidAs(row.unit, me.language, main),
    choices: row.choices ? row.choices.map((c) => ({ ...c, label: saidAs(c.label, me.language, main) })) : row.choices
  });
  const roles = manifest.ai ? manifest.ai.roles : [];
  let layout = {
    sidebar_width: null,
    sidebar_collapsed: false,
    limits: { sidebar_width: { min: 180, max: 360, default: 224 } }
  };
  const agents = Object.fromEntries(
    roles.map((r) => [r.id, { role: r.id, model: "", effort: "" }])
  );
  const answers = {
    // The browser comes to these from NEX Manager — never inside the preview.
    launch: null,
    launchPost: null,
    login: () => json(me),
    logout: () => noContent(),
    health: () => json({ status: "ok", version: "n\xE1h\u013Ead", checks: { database: "ok" } }),
    me: () => json(me),
    updateMe: ({ body }) => json({ ...me, ...body }),
    changePassword: () => noContent(),
    // DEV-394: the preview takes the choice, so the Manažér sees the app in each of its languages.
    setLanguage: ({ body }) => {
      me = { ...me, language: body.language ?? null };
      return json(me);
    },
    listUsers: () => json(people),
    createUser: ({ body }) => json({ ...colleague, ...body, id: "nahlad-novy" }, 201),
    updateUser: ({ params, body }) => json({ ...people.find((u) => u.id === params.id) ?? colleague, ...body, id: String(params.id) }),
    deleteUser: () => noContent(),
    setUserPassword: () => noContent(),
    listSessions: () => json([session]),
    revokeSession: () => noContent(),
    listSystemSettings: () => json(settings.map(saidIn)),
    updateSystemSetting: ({ params, body }) => {
      const row = settings.find((s) => s.key === params.key) ?? settings[0];
      return json({ ...row && saidIn(row), value: body.value, is_default: false, updated_at: NOW, updated_by_username: me.username });
    },
    listAgentSettings: () => json(roles.map((r) => agents[r.id])),
    listAgentModels: () => json([
      { id: "opus", label: "Opus" },
      { id: "sonnet", label: "Sonnet" },
      { id: "haiku", label: "Haiku" }
    ]),
    saveAgentSetting: ({ params, body }) => {
      const row = { role: String(params.role), ...body };
      agents[row.role] = row;
      return json(row);
    },
    getLayout: () => json(layout),
    saveLayout: ({ body }) => {
      layout = { ...layout, ...body };
      return json(layout);
    },
    releaseNotes: () => json(
      options.releaseNotes ?? [
        { version: "v0.1.0", released_at: null, markdown: "Uk\xE1\u017Eka \u2014 pozn\xE1mky k vydaniu nap\xED\u0161e agent do docs/specs/versions." }
      ]
    ),
    gettingStarted: () => json({ markdown: options.gettingStarted ?? "Uk\xE1\u017Eka \u2014 n\xE1vod pre \u010Dloveka, ktor\xFD aplik\xE1ciu e\u0161te nevidel, nap\xED\u0161e agent do docs/AKO_ZACAT.md." }),
    // DEV-377: the preview serves no customer — it looks as an app outside the cockpit.
    installation: () => json({ customer: null, environment: null }),
    installationManifest: () => json({ name: manifest.name, short_name: manifest.name, start_url: "/", display: "standalone" })
  };
  const allowed = /* @__PURE__ */ new Set(["always", manifest.auth === "password" ? "password" : "manager", ...manifest.ai ? ["ai"] : []]);
  return STANDARD_ENDPOINTS.filter((e) => allowed.has(e.scope)).flatMap((e) => {
    const answer = answers[e.id];
    if (!answer) return [];
    const path = `*/api/v1${e.path.replace(/\{(\w+)\}/g, ":$1")}`;
    const method = e.method.toLowerCase();
    return [
      http[method](path, async ({ request, params }) => {
        const text = request.method === "GET" || request.method === "DELETE" ? "" : await request.text();
        return answer({ params, body: text ? JSON.parse(text) : void 0 });
      })
    ];
  });
}
export {
  SERVER_CATALOGS,
  previewHandlers
};
