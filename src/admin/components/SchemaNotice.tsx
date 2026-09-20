/**
 * What a screen shows when the database is not ready, or is ready but says no.
 *
 * The portal is written before the migration runs, and it will be opened by
 * people who cannot fix either problem, so the wording says what happened and
 * who can do something about it rather than offering a retry that will fail
 * the same way.
 */
import type { AppError } from '../lib/errors';
import { IconWarning } from './Icons';

export function SchemaNotice({ error, what }: { error: AppError; what?: string }) {
  const title = error.missingSchema
    ? 'The database is not set up yet'
    : error.permission
      ? 'You do not have access to this'
      : error.offline
        ? 'Cannot reach the server'
        : 'Something went wrong';

  const body = error.missingSchema
    ? `The Workbench is connected, but the tables it needs are not there yet. An administrator needs to run the migration${what ? ` before ${what} will work` : ''}.`
    : error.permission
      ? 'Ask an administrator to add you, or to give you a higher role on this project.'
      : error.offline
        ? 'Check the connection. The page will catch up on its own once the connection is back.'
        : error.message;

  return (
    <div class="wb-notice wb-notice-warn" role="status">
      <span class="wb-notice-icon" aria-hidden="true">
        <IconWarning size={18} />
      </span>
      <div>
        <p class="wb-notice-title">{title}</p>
        <p class="wb-notice-body">{body}</p>
      </div>
    </div>
  );
}

/** The thin strip along the top of a project while the socket is down. */
export function ConnectionBanner({ state }: { state: 'reconnecting' | 'offline' }) {
  return (
    <div class="wb-reconnect" role="status">
      <span class="wb-reconnect-dot" aria-hidden="true" />
      {state === 'offline'
        ? 'Offline. Changes will not be saved until the connection comes back.'
        : 'Reconnecting. You may not see other people’s changes for a moment.'}
    </div>
  );
}
