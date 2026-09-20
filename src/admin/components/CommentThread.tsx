/**
 * A realtime comment thread for any entity (a task, a report, a partner, a
 * note). The rows arrive through the project's single realtime channel, so
 * there is no polling here.
 */
import { useState } from 'preact/hooks';
import { useComments, useProject } from '../lib/store';
import { getAuth } from '../lib/auth';
import { fullTime, relativeTime } from '../lib/format';
import { toast } from '../lib/toasts';
import type { CommentEntity } from '../lib/types';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { Textarea } from './Field';
import { IconTrash } from './Icons';
import { Skeleton } from './Skeleton';
import { RichText } from './RichText';

export interface CommentThreadProps {
  entity: CommentEntity;
  id: string;
  /** Viewers may still comment; only a missing membership blocks it. */
  canComment?: boolean;
  label?: string;
}

export function CommentThread({ entity, id, canComment = true, label = 'Comments' }: CommentThreadProps) {
  const { profiles, canManage } = useProject();
  const thread = useComments(entity, id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const me = getAuth().userId;

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    const result = await thread.add(body);
    setSending(false);
    if (result.ok) setDraft('');
    else if (result.error) toast.bad(result.error.message);
  };

  return (
    <section class="wb-comments">
      <h4 class="wb-comments-title">
        {label}
        {thread.rows.length ? <span class="wb-mono-soft"> {thread.rows.length}</span> : null}
      </h4>

      {thread.loading && !thread.rows.length ? (
        <div class="wb-comments-loading">
          <Skeleton width="80%" />
          <Skeleton width="55%" />
        </div>
      ) : null}

      {thread.rows.length ? (
        <ol class="wb-comment-list">
          {thread.rows.map((comment) => {
            const profile = profiles[comment.user_id];
            const mine = comment.user_id === me;
            return (
              <li class="wb-comment" key={comment.id}>
                <Avatar id={comment.user_id} name={profile?.full_name} email={profile?.email} size={26} />
                <div class="wb-comment-body">
                  <p class="wb-comment-meta">
                    <span class="wb-comment-who">
                      {profile?.full_name?.trim() || profile?.email || 'Someone'}
                    </span>
                    <span class="wb-mono-soft" title={fullTime(comment.created_at)}>
                      {relativeTime(comment.created_at)}
                    </span>
                  </p>
                  <RichText text={comment.body} class="wb-comment-text" />
                </div>
                {mine || canManage ? (
                  <Button
                    variant="quiet"
                    size="sm"
                    iconOnly
                    aria-label="Delete this comment"
                    icon={<IconTrash size={14} />}
                    onClick={async () => {
                      const result = await thread.remove(comment.id);
                      if (!result.ok && result.error) toast.bad(result.error.message);
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : thread.loading ? null : (
        <p class="wb-comments-empty">No comments yet.</p>
      )}

      {canComment ? (
        <div class="wb-comment-form">
          <Textarea
            rows={2}
            value={draft}
            aria-label="Write a comment"
            placeholder="Add a comment"
            onInput={(event) => setDraft((event.currentTarget as HTMLTextAreaElement).value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send();
            }}
          />
          <Button variant="primary" size="sm" busy={sending} disabled={!draft.trim()} onClick={send}>
            Comment
          </Button>
        </div>
      ) : null}
    </section>
  );
}
