/**
 * Every project this person can see. Administrators can also start one from
 * scratch, bring one in from a file, or take one back out again.
 */
import { useCallback, useEffect, useState } from 'preact/hooks';
import { displayName, isAdmin, useAuth } from '../lib/auth';
import { loadHome, type HomeData } from '../lib/queries';
import { buildProjectFile, downloadJson } from '../lib/transfer';
import { toast } from '../lib/toasts';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCards } from '../components/Skeleton';
import { IconDownload, IconPlus, IconProjects, IconUpload } from '../components/Icons';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import { ImportDialog } from './ImportDialog';
import { SchemaNotice } from '../components/SchemaNotice';
import { Select } from '../components/Select';

export function Projects() {
  const auth = useAuth();
  const admin = isAdmin(auth);
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportId, setExportId] = useState('');
  const [exporting, setExporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await loadHome(auth.userId, displayName(auth));
    setData(result);
    setLoading(false);
  }, [auth.userId, auth.profile?.full_name]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const all = data?.projects ?? [];
  const visible = all.filter((summary) =>
    showArchived ? summary.project.status === 'archived' : summary.project.status === 'active'
  );
  const archivedCount = all.filter((summary) => summary.project.status === 'archived').length;

  const exportOne = async (projectId: string) => {
    const summary = all.find((entry) => entry.project.id === projectId);
    if (!summary) return;
    setExporting(true);
    try {
      const file = await buildProjectFile(projectId);
      downloadJson(`${summary.project.slug}.mmt-project.json`, file);
      toast.good('Exported.');
    } catch (error) {
      toast.error(error, 'export');
    } finally {
      setExporting(false);
      setExportId('');
    }
  };

  return (
    <div class="wb-page">
      <header class="wb-page-head">
        <div>
          <h1 class="wb-page-title">Projects</h1>
          <p class="wb-page-sub">Everything you have been given access to.</p>
        </div>
        {admin ? (
          <div class="wb-toolbar">
            <Button variant="secondary" icon={<IconUpload size={16} />} onClick={() => setImporting(true)}>
              Import from file
            </Button>
            <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setCreating(true)}>
              New project
            </Button>
          </div>
        ) : null}
      </header>

      {data?.error ? <SchemaNotice error={data.error} what="the project list" /> : null}

      <div class="wb-filters">
        <Checkbox
          label={`Show archived${archivedCount ? ` (${archivedCount})` : ''}`}
          checked={showArchived}
          onChange={(event) => setShowArchived((event.currentTarget as HTMLInputElement).checked)}
        />
        {admin && all.length ? (
          <span class="wb-toolbar">
            <Select
              value={exportId}
              placeholder="Export a project to JSON"
              options={all.map((summary) => ({
                value: summary.project.id,
                label: summary.project.name,
              }))}
              size="sm"
              aria-label="Export a project"
              onValue={(value) => {
                setExportId(value);
                if (value) void exportOne(value);
              }}
            />
            {exporting ? (
              <span class="wb-mono-soft">
                <IconDownload size={15} /> preparing
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {loading ? (
        <SkeletonCards count={3} />
      ) : visible.length ? (
        <div class="wb-card-grid">
          {visible.map((summary) => (
            <ProjectCard key={summary.project.id} summary={summary} profiles={data?.profiles ?? {}} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<IconProjects size={24} />}
          title={showArchived ? 'Nothing archived' : 'No projects yet'}
          body={
            showArchived
              ? 'Archived projects stay here, out of the way but not deleted.'
              : admin
                ? 'Start one from scratch, or bring one in from a file.'
                : 'Once somebody adds you to a project it will show up here.'
          }
          action={
            admin && !showArchived ? (
              <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setCreating(true)}>
                New project
              </Button>
            ) : null
          }
        />
      )}

      <NewProjectDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          void refresh();
        }}
      />
      <ImportDialog
        open={importing}
        onClose={() => {
          setImporting(false);
          void refresh();
        }}
      />
    </div>
  );
}
