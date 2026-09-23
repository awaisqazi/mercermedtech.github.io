/**
 * `#/` has no screen of its own: it opens the home project's Plan, because
 * that is the project the portal revolves around. With no project at all (a
 * brand-new account) it opens Today instead, which says so.
 */
import { useEffect, useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { pickPrimary, useProjectList } from '../lib/projects';
import { SLOW_LOAD_MS } from '../lib/config';
import { SkeletonLines } from '../components/Skeleton';
import { SlowNotice } from '../components/SchemaNotice';

export function HomeRedirect() {
  const list = useProjectList();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (list.status === 'ready' || list.status === 'error') {
      const primary = pickPrimary(list.projects);
      navigate(primary ? `/p/${primary.slug}/plan` : '/today', { replace: true });
    }
  }, [list.status, list.projects]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div class="wb-page">
      {slow ? <SlowNotice what="Finding your project" /> : null}
      <SkeletonLines count={2} />
    </div>
  );
}
