/**
 * What a screen shows when the database is not ready, or is ready but says no.
 *
 * The portal is written before the migration runs, and it will be opened by
 * people who cannot fix either problem, so the wording says what happened and
 * who can do something about it rather than offering a retry that will fail
 * the same way.
 */
import type { ComponentChildren } from 'preact';
import type { AppError } from '../lib/errors';
import { IconWarning } from './Icons';

export function SchemaNotice({
  error,
  what,
  action,
}: {
  error: AppError;
  what?: string;
  /** A Retry button, where trying again could actually help. */
  action?: ComponentChildren;
}) {
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
      : // "Cannot reach" covers both a connection that is gone and one that
        // simply never answered, and those want different sentences, so the
        // error's own wording is used rather than a single guess at which.
        error.message;

  return (
    <div class="wb-notice wb-notice-warn" role="status">
      <span class="wb-notice-icon" aria-hidden="true">
        <IconWarning size={18} />
      </span>
      <div>
        <p class="wb-notice-title">{title}</p>
        <p class="wb-notice-body">{body}</p>
        {action ? <div class="wb-notice-action">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * Shown when a load has been going for a few seconds and is still going.
 *
 * A placeholder on its own says "working"; after four seconds that stops being
 * true and starts being a question. This answers it before the reader has to
 * wonder whether the page is broken.
 */
export function SlowNotice({ what = 'This' }: { what?: string }) {
  return (
    <p class="wb-slow-note" role="status" data-wb-slow>
      {what} is taking longer than usual. Still trying.
    </p>
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
