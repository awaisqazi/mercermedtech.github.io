/**
 * Settings (#/settings = Projects, #/settings/roles = Roles).
 *
 * Each tab appears only for a person who has its permission (projects.manage,
 * roles.manage). A person with neither gets a plain empty state. If the
 * address names a tab the person may not use but another is open to them, the
 * other one is shown.
 */
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { Tabs } from '../../components/Tabs';
import { useCan } from '../../lib/perms';
import { href } from '../../lib/router';
import { Projects } from './Projects';
import { Roles } from './Roles';

export function Settings({ tab }: { tab: 'projects' | 'roles' }) {
  const canProjects = useCan('projects.manage');
  const canRoles = useCan('roles.manage');

  if (!canProjects && !canRoles) {
    return (
      <div class="wb-page">
        <PageHeader title="Settings" />
        <EmptyState
          title="Settings are not part of your role"
          body="Projects and roles are managed by people with that permission. Ask an administrator if you need a change."
        />
      </div>
    );
  }

  const active: 'projects' | 'roles' = tab === 'roles' ? (canRoles ? 'roles' : 'projects') : canProjects ? 'projects' : 'roles';
  const tabs = [
    ...(canProjects ? [{ key: 'projects', label: 'Projects', href: href('/settings') }] : []),
    ...(canRoles ? [{ key: 'roles', label: 'Roles', href: href('/settings/roles') }] : []),
  ];

  return (
    <div class="wb-page wb-settings">
      <PageHeader title="Settings" />
      {tabs.length > 1 ? <Tabs tabs={tabs} active={active} label="Settings sections" /> : null}
      {active === 'projects' ? <Projects /> : <Roles />}
    </div>
  );
}
