/**
 * The only inline markup the portal understands is `**bold**`.
 *
 * This is deliberately a parser that emits elements, not a string of HTML:
 * nothing typed by a user ever reaches `dangerouslySetInnerHTML`, so there is
 * no way for a pasted `<script>` to become one. A `https://` link on its own
 * is turned into an anchor, with `rel="noopener noreferrer"`.
 */
import type { JSX } from 'preact';

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

function linkify(text: string, keyPrefix: string): Array<JSX.Element | string> {
  const out: Array<JSX.Element | string> = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const url = match[0].replace(/[.,;:)]+$/, '');
    out.push(
      <a key={`${keyPrefix}-a${index}`} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    last = start + url.length;
    index += 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Splits on `**…**` and returns real elements. */
export function renderRichText(text: string, keyPrefix = 'rt'): Array<JSX.Element | string> {
  const source = text ?? '';
  const out: Array<JSX.Element | string> = [];
  const pattern = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  let index = 0;

  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) out.push(...linkify(source.slice(last, start), `${keyPrefix}-${index}p`));
    out.push(
      <strong key={`${keyPrefix}-${index}b`}>{linkify(match[1] ?? '', `${keyPrefix}-${index}bb`)}</strong>
    );
    last = start + match[0].length;
    index += 1;
  }
  if (last < source.length) out.push(...linkify(source.slice(last), `${keyPrefix}-tail`));
  return out;
}

export interface RichTextProps {
  text: string;
  /** The wrapper element. Defaults to a paragraph. */
  as?: 'p' | 'span' | 'div' | 'li';
  class?: string;
}

export function RichText({ text, as = 'p', class: className }: RichTextProps) {
  const children = renderRichText(text);
  if (as === 'span') return <span class={className}>{children}</span>;
  if (as === 'div') return <div class={className}>{children}</div>;
  if (as === 'li') return <li class={className}>{children}</li>;
  return <p class={className}>{children}</p>;
}
