/**
 * Partners: who sends people our way, where they are, and what the next move
 * with each of them is.
 *
 * At the top, one line of county chips: the referrals from each county, and
 * a warning where nobody is referring yet (said in words too, in the chip's
 * label). Below it, a compact list; a partner opens in its own panel with the
 * contact, the next step, the notes, the comments and the history.
 *
 * The counties and the kinds of organisation are settings (`config.counties`,
 * `config.partner_kinds`), so nothing here knows about any real place.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import { deleteRow, insertRow, setPresence, usePartners, useProject } from '../../lib/store';
import { setQuery, useRoute } from '../../lib/router';
import { relativeTime } from '../../lib/format';
import { toast } from '../../lib/toasts';
import { getAuth } from '../../lib/auth';
import { PARTNER_STAGES, PARTNER_STAGE_LABEL, type Partner, type PartnerStage } from '../../lib/types';
import { Button } from '../../components/Button';
import { CommentThread } from '../../components/CommentThread';
import { useConfirm } from '../../components/ConfirmDialog';
import { Dialog } from '../../components/Dialog';
import { EmptyState } from '../../components/EmptyState';
import { Field, Input } from '../../components/Field';
import { History } from '../../components/History';
import { LiveNumber, LiveSelect, LiveText, LiveTextarea } from '../../components/LiveField';
import { Menu } from '../../components/Menu';
import { Modal } from '../../components/Modal';
import { Select, optionsFrom } from '../../components/Select';
import { IconDots, IconPeople, IconPlus, IconSearch, IconTrash } from '../../components/Icons';
import { changedSince } from '../../components/tasks/shared';

/** A partner at this stage is actually sending people. */
const ACTIVE_STAGE: PartnerStage = 'referring';

const STAGE_TONE: Record<PartnerStage, string> = {
  not_contacted: 'quiet',
  contacted: 'neutral',
  meeting_held: 'accent',
  referring: 'good',
  paused: 'warn',
};

function uniqueStrings(...lists: Array<Array<string | null | undefined>>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const value = (raw ?? '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

export function Partners() {
  const partners = usePartners();
  const route = useRoute();
  const { config, readOnly } = useProject();
  const auth = getAuth();
  const [county, setCounty] = useState('');
  const [stage, setStage] = useState<PartnerStage | ''>('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const configCounties = Array.isArray(config.counties) ? (config.counties as unknown[]).map(String) : [];
  const configKinds = Array.isArray(config.partner_kinds) ? (config.partner_kinds as unknown[]).map(String) : [];
  const counties = uniqueStrings(configCounties, partners.map((partner) => partner.county));
  const kinds = uniqueStrings(configKinds, partners.map((partner) => partner.kind));

  const coverage = configCounties.map((name) => {
    const own = partners.filter((partner) => partner.county === name);
    return {
      name,
      partners: own.length,
      referring: own.filter((partner) => partner.stage === ACTIVE_STAGE).length,
      referrals: own.reduce((sum, partner) => sum + (Number(partner.referrals) || 0), 0),
    };
  });
  const gaps = coverage.filter((entry) => !entry.referring).length;
  const totalReferrals = partners.reduce((sum, partner) => sum + (Number(partner.referrals) || 0), 0);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return partners.filter((partner) => {
      if (county && partner.county !== county) return false;
      if (stage && partner.stage !== stage) return false;
      if (needle && ![partner.name, partner.contact, partner.kind, partner.notes].join(' ').toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [partners, county, stage, search]);

  const filtered = Boolean(county || stage || search.trim());
  const clear = () => {
    setCounty('');
    setStage('');
    setSearch('');
  };

  const openId = route.query.partner || null;
  const open = (id: string | null) => setQuery({ ...route.query, partner: id });
  const openPartner = openId ? (partners.find((partner) => partner.id === openId) ?? null) : null;

  return (
    <section class="wb-partners" aria-label="Partners">
      <div class="wb-section-bar">
        <p class="wb-section-summary">
          <strong>{partners.length}</strong> partners · <strong>{totalReferrals}</strong> referrals
          {coverage.length ? (
            <span class={gaps ? 'wb-warn-text' : 'wb-mono-soft'}>
              {' '}
              · {gaps ? `${gaps} of ${coverage.length} counties with nobody referring yet` : 'someone referring in every county'}
            </span>
          ) : null}
        </p>
        {readOnly ? null : (
          <Button variant="secondary" size="sm" icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>
            Add a partner
          </Button>
        )}
      </div>

      {coverage.length ? (
        <ul class="wb-coverage-strip" aria-label="Referrals by county">
          {coverage.map((entry) => (
            <li key={entry.name}>
              <button
                type="button"
                class={`wb-county${entry.referring ? '' : ' is-gap'}${county === entry.name ? ' is-active' : ''}`}
                aria-pressed={county === entry.name}
                title={
                  entry.referring
                    ? `${entry.name}: ${entry.referring} referring, ${entry.referrals} referrals`
                    : `${entry.name}: nobody referring yet`
                }
                onClick={() => setCounty((current) => (current === entry.name ? '' : entry.name))}
              >
                <span class="wb-county-name">{entry.name.replace(/ County$/, '')}</span>
                <span class="wb-county-count wb-mono">{entry.referrals}</span>
                {entry.referring ? null : <span class="wb-sr">, nobody referring yet</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div class="wb-plan-bar">
        <div class="wb-plan-chips" role="group" aria-label="Show only">
          {PARTNER_STAGES.map((key) => {
            const count = partners.filter((partner) => partner.stage === key).length;
            if (!count) return null;
            return (
              <button
                key={key}
                type="button"
                class={`wb-chip wb-chip-toggle${stage === key ? ' is-active' : ''}`}
                aria-pressed={stage === key}
                onClick={() => setStage((current) => (current === key ? '' : key))}
              >
                {PARTNER_STAGE_LABEL[key]}
                <span class="wb-chip-count wb-mono">{count}</span>
              </button>
            );
          })}
          {filtered ? (
            <button type="button" class="wb-linkish wb-plan-clear" onClick={clear}>
              Clear
            </button>
          ) : null}
        </div>
        <label class="wb-search wb-plan-search">
          <IconSearch size={16} />
          <span class="wb-sr">Search partners</span>
          <input
            class="wb-input wb-input-sm"
            type="search"
            value={search}
            placeholder="Search"
            onInput={(event) => setSearch((event.currentTarget as HTMLInputElement).value)}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<IconPeople size={22} />}
          title={filtered ? 'No partners match' : 'No partners yet'}
          body={
            filtered
              ? 'Take a filter off to see more.'
              : readOnly
                ? 'Nobody has been added to this project yet.'
                : 'Add the organisations that send people your way, and everyone sees the same picture.'
          }
          action={
            filtered ? (
              <Button variant="secondary" onClick={clear}>
                Clear the filters
              </Button>
            ) : readOnly ? null : (
              <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
                Add the first partner
              </Button>
            )
          }
        />
      ) : (
        <div class="wb-list" role="table" aria-label="Partners">
          <div class="wb-list-head" role="row">
            <span role="columnheader">Partner</span>
            <span role="columnheader">County</span>
            <span role="columnheader">Stage</span>
            <span role="columnheader" class="wb-num">
              Referrals
            </span>
            <span role="columnheader">Updated</span>
          </div>
          {visible.map((partner) => (
            <div
              class={`wb-list-row${openId === partner.id ? ' is-open' : ''}`}
              role="row"
              key={partner.id}
            >
              <span role="cell" class="wb-list-name">
                <button type="button" class="wb-row-main" onClick={() => open(partner.id)}>
                  <span class="wb-row-title">
                    {changedSince(partner, auth.lastVisit, auth.userId) ? (
                      <span class="wb-new-dot" title="Changed since you were last here" />
                    ) : null}
                    {partner.name}
                  </span>
                  {partner.kind ? <span class="wb-ws">{partner.kind}</span> : null}
                </button>
              </span>
              <span role="cell" class="wb-list-county">
                {partner.county || 'Not set'}
              </span>
              <span role="cell">
                <span class={`wb-pill wb-pill-${STAGE_TONE[partner.stage]}`}>{PARTNER_STAGE_LABEL[partner.stage]}</span>
              </span>
              <span role="cell" class="wb-num wb-mono">
                {partner.referrals}
              </span>
              <span role="cell" class="wb-mono-soft wb-list-when">
                {relativeTime(partner.updated_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <PartnerModal partner={openPartner} counties={counties} kinds={kinds} onClose={() => open(null)} />

      <Dialog open={adding} title="Add a partner" onClose={() => setAdding(false)} size="sm">
        <AddPartner
          partners={partners}
          counties={counties}
          kinds={kinds}
          onClose={(id) => {
            setAdding(false);
            if (id) open(id);
          }}
        />
      </Dialog>
    </section>
  );
}

/* ----------------------------------------------------------- the panel --- */

function PartnerModal({
  partner,
  counties,
  kinds,
  onClose,
}: {
  partner: Partner | null;
  counties: string[];
  kinds: string[];
  onClose: () => void;
}) {
  const { readOnly } = useProject();
  const { confirm, element } = useConfirm();
  const id = partner?.id ?? '';

  useEffect(() => {
    if (!id) return;
    setPresence({ editing: `partner:${id}` });
    return () => setPresence({ editing: '' });
  }, [id]);

  if (!partner) return element;

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${partner.name}?`,
      body: 'This removes the partner for everyone. Anything recorded about them goes with it.',
      confirmLabel: 'Remove the partner',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteRow('partners', partner.id);
    if (result.ok) {
      toast.good('Removed.');
      onClose();
    } else if (result.error) toast.bad(result.error.message);
  };

  const choice = (value: string, list: string[]) =>
    [{ value: '', label: 'Not set' }, ...uniqueStrings(list, [value]).map((entry) => ({ value: entry, label: entry }))];

  return (
    <>
      <Modal
        open
        side
        size="lg"
        label={`Partner: ${partner.name}`}
        onClose={onClose}
        initialFocus="panel"
        title={
          <LiveText
            table="partners"
            id={partner.id}
            field="name"
            value={partner.name}
            label="Name"
            hideLabel
            readOnly={readOnly}
            class="wb-title-field"
          />
        }
        description={<span class="wb-mono-soft">Last changed {relativeTime(partner.updated_at)}</span>}
        actions={
          readOnly ? null : (
            <Menu
              align="right"
              items={[
                {
                  key: 'remove',
                  label: 'Remove this partner',
                  icon: <IconTrash size={16} />,
                  tone: 'danger',
                  onSelect: () => void remove(),
                },
              ]}
              trigger={(props) => (
                <button type="button" class="wb-icon-button" aria-label="More for this partner" {...props}>
                  <IconDots />
                </button>
              )}
            />
          )
        }
      >
        <div class="wb-props">
          <LiveSelect<PartnerStage>
            table="partners"
            id={partner.id}
            field="stage"
            value={partner.stage}
            label="Stage"
            tone={partner.stage === 'referring' ? 'done' : undefined}
            options={optionsFrom(PARTNER_STAGES, PARTNER_STAGE_LABEL)}
            readOnly={readOnly}
          />
          <LiveNumber
            table="partners"
            id={partner.id}
            field="referrals"
            value={partner.referrals}
            label="Referrals"
            min={0}
            step={1}
            readOnly={readOnly}
          />
          <LiveSelect
            table="partners"
            id={partner.id}
            field="county"
            value={partner.county}
            label="County"
            options={choice(partner.county, counties)}
            readOnly={readOnly}
          />
          <LiveSelect
            table="partners"
            id={partner.id}
            field="kind"
            value={partner.kind}
            label="Kind"
            options={choice(partner.kind, kinds)}
            readOnly={readOnly}
          />
        </div>
        <div class="wb-longform">
          <LiveText
            table="partners"
            id={partner.id}
            field="contact"
            value={partner.contact}
            label="Contact"
            placeholder="Who we speak to"
            readOnly={readOnly}
          />
          <LiveText
            table="partners"
            id={partner.id}
            field="next_step"
            value={partner.next_step}
            label="Next step"
            placeholder="What happens next"
            readOnly={readOnly}
          />
          <LiveTextarea
            table="partners"
            id={partner.id}
            field="notes"
            value={partner.notes}
            label="Notes"
            rows={3}
            placeholder="Anything worth remembering"
            readOnly={readOnly}
          />
        </div>
        <CommentThread entity="partner" id={partner.id} />
        <History entityId={partner.id} />
      </Modal>
      {element}
    </>
  );
}

/* -------------------------------------------------------- add a partner --- */

function AddPartner({
  partners,
  counties,
  kinds,
  onClose,
}: {
  partners: Partner[];
  counties: string[];
  kinds: string[];
  onClose: (id?: string) => void;
}) {
  const [name, setName] = useState('');
  const [county, setCounty] = useState('');
  const [kind, setKind] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: Event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Give the organisation a name.');
      return;
    }
    setError(null);
    setSaving(true);
    const result = await insertRow<Partner>('partners', {
      name: clean,
      county: county.trim(),
      kind: kind.trim(),
      stage: 'not_contacted',
      contact: '',
      next_step: '',
      notes: '',
      referrals: 0,
      sort: partners.reduce((highest, partner) => Math.max(highest, partner.sort), 0) + 10,
    });
    setSaving(false);
    if (result.ok) {
      toast.good('Partner added.');
      onClose(result.row?.id);
    } else if (result.error) {
      setError(result.error.message);
    }
  };

  const picker = (value: string, set: (next: string) => void, list: string[]) =>
    (props: { id: string }) =>
      list.length ? (
        <Select
          {...props}
          value={value}
          placeholder="Not set"
          options={list.map((entry) => ({ value: entry, label: entry }))}
          onValue={set}
        />
      ) : (
        <Input {...props} value={value} onInput={(event) => set((event.currentTarget as HTMLInputElement).value)} />
      );

  return (
    <form class="wb-form" onSubmit={submit}>
      <Field label="Name" required error={error}>
        {(props) => (
          <Input
            {...props}
            value={name}
            placeholder="The organisation"
            onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
          />
        )}
      </Field>
      <Field label="County">{picker(county, setCounty, counties)}</Field>
      <Field label="Kind">{picker(kind, setKind, kinds)}</Field>
      <div class="wb-form-actions">
        <Button variant="quiet" onClick={() => onClose()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving} disabled={!name.trim()}>
          Add the partner
        </Button>
      </div>
    </form>
  );
}
