import { HttpHandler } from 'msw';
import { SystemSettingRead, ReleaseNote } from 'nex-shared';
import { A as AppManifest, C as CurrentUser } from './standard-api-BV9y5xYB.js';

interface PreviewOptions {
    manifest: AppManifest;
    /** Who is signed in; an admin with nothing due unless the app says otherwise. */
    user?: Partial<CurrentUser>;
    /** The app's own system settings, as its server would list them. */
    settings?: SystemSettingRead[];
    releaseNotes?: ReleaseNote[];
    /** Ako začať — Markdown. */
    gettingStarted?: string;
}
declare function previewHandlers(options: PreviewOptions): HttpHandler[];

export { type PreviewOptions, previewHandlers };
