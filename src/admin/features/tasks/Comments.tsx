/**
 * A task's comments, newest last, and the composer pinned to the bottom of
 * the drawer. Everyone with an account may comment; a person may delete
 * their own. `**bold**` is the only markup, rendered by RichText.
 */
import { useRef, useState } from 'preact/hooks';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useConfirm } from '../../components/ConfirmDialog';
import { IconTrash } from '../../components/Icons';
import { RichText } from '../../components/RichText';
import { SkeletonLines } from '../../components/Skeleton';
import { useAuth } from '../../lib/auth';
import { fullTime, relativeTime } from '../../lib/format';
import { addComment, deleteComment, useComments, useProfiles } from '../../lib/workspace';

export function CommentList({ taskId }: { taskId: string }) {
  const { rows, loading } = useComments(taskId);
  const people = useProfiles();
  const me = useAuth().userId;
  const { confirm, element } = useConfirm();

  const remove = async (id: string) => {
    const yes = await confirm({
      title: 'Delete this comment?',
      body: 'It goes for everyone, and it cannot be brought back.',
      confirmLabel: 'Delete comment',
      tone: 'danger',
    });
    if (yes) void deleteComment(id);
  };

  return (
    <section class="wb-task-section" aria-labelledby={`comments-${taskId}`}>
      <div class="wb-task-section-head">
        <h3 class="wb-task-section-title" id={`comments-${taskId}`}>
          Comments
        </h3>
        {rows.length ? <span class="wb-meta wb-mono">{rows.length}</span> : null}
      </div>
      {loading && !rows.length ? (
        <SkeletonLines count={2} />
      ) : rows.length ? (
        <ol class="wb-comments">
          {rows.map((row) => {
            const person = people.find((profile) => profile.id === row.user_id) ?? null;
            const name = person?.full_name || person?.email || 'Someone';
            return (
              <li key={row.id} class="wb-comment">
                <Avatar id={row.user_id} name={person?.full_name} email={person?.email} size={28} />
                <div class="wb-comment-main">
                  <p class="wb-comment-head">
                    <span class="wb-comment-name">{name}</span>
                    <time class="wb-meta" dateTime={row.created_at} title={fullTime(row.created_at)}>
                      {relativeTime(row.created_at)}
                    </time>
                  </p>
                  <RichText text={row.body} class="wb-comment-body" />
                </div>
                {row.user_id === me ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    class="wb-comment-delete"
                    aria-label="Delete your comment"
                    icon={<IconTrash size={16} />}
                    onClick={() => void remove(row.id)}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p class="wb-meta">No comments yet. Ask a question or say where it stands.</p>
      )}
      {element}
    </section>
  );
}

export function CommentComposer({ taskId }: { taskId: string }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const send = async (event?: Event) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setDraft('');
    const result = await addComment(taskId, body);
    setBusy(false);
    if (!result.ok) setDraft(body);
    else {
      // Bring the new comment into view; it is the last one.
      const list = box.current?.closest('.wb-drawer')?.querySelector('.wb-comments');
      list?.lastElementChild?.scrollIntoView({ block: 'nearest' });
    }
    box.current?.focus();
  };

  return (
    <form class="wb-composer" onSubmit={send}>
      <label class="wb-sr" for={`composer-${taskId}`}>
        Write a comment
      </label>
      <textarea
        id={`composer-${taskId}`}
        ref={box}
        class="wb-input wb-textarea wb-composer-input"
        rows={2}
        placeholder="Write a comment"
        value={draft}
        maxLength={4000}
        onInput={(event) => setDraft((event.currentTarget as HTMLTextAreaElement).value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send(event);
        }}
      />
      <Button type="submit" variant="primary" busy={busy}>
        Comment
      </Button>
    </form>
  );
}
