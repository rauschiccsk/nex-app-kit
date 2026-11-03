import { HttpHandler } from 'msw';
import { UserRead, SystemSettingRead, ReleaseNote } from 'nex-shared';
import { A as AppManifest, C as CurrentUser } from './standard-api-CSChwOlo.js';
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
declare function previewHandlers(options: PreviewOptions): HttpHandler[];

export { type PreviewOptions, previewHandlers };
