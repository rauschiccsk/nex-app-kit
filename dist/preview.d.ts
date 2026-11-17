import { HttpHandler } from 'msw';
import { UserRead, SystemSettingRead, ReleaseNote } from 'nex-shared';
import { A as AppManifest, C as CurrentUser } from './standard-api-DgTwrpJ3.js';
import 'react';

interface PreviewOptions {
    manifest: AppManifest;
    /** Who is signed in; an admin with nothing due unless the app says otherwise. */
    user?: Partial<CurrentUser>;
    /** The app's own sample people for Nastavenia → Používatelia — the same ones its own screens show, so the two never
     *  disagree in the preview (DEV-292). The signed-in person is always among them: the entry with the same ``id`` is
     *  the signed-in one, and when none has it, the signed-in person comes first. Missing fields are filled. Without it,
     *  the list is the signed-in person and one sample colleague. */
    users?: Array<Partial<UserRead> & Pick<UserRead, "id" | "username">>;
    /** The app's own system settings, as its server would list them. */
    settings?: SystemSettingRead[];
    releaseNotes?: ReleaseNote[];
    /** Ako začať — Markdown. */
    gettingStarted?: string;
}
/**
 * DEV-421 — the server's own catalogs, the same files it says the template's settings from. The template's settings
 * carry keys since 0.14.0 (DEV-394) and the server says them in the person's language; the preview has no server, and
 * until 0.16.2 it passed the keys on — „kit.setting.idle.label“ on Nastavenia → Systém in every language (NEX Manager
 * 1.7.0, 17.11.2026).
 */
declare const SERVER_CATALOGS: Readonly<Record<string, Readonly<Record<string, string>>>>;
declare function previewHandlers(options: PreviewOptions): HttpHandler[];

export { type PreviewOptions, SERVER_CATALOGS, previewHandlers };
