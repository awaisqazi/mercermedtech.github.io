/**
 * Partners: who sends people our way, where they are, and what the next move
 * with each of them is.
 *
 * The counties and the kinds of organisation are settings
 * (`config.counties`, `config.partner_kinds`), so the coverage strip at the
 * top is really one question asked once per county: is anybody actually
 * referring from here? That answer is given in words, not only in colour.
 */
import { useMemo, useState } from 'preact/hooks';
import {
  deleteRow,
  insertRow,
  usePartners,
  useProject,
} from '../../lib/store';
import { plural } from '../../lib/format';
import { toast } from '../../lib/toasts';
import {
  PARTNER_STAGES,
  PARTNER_STAGE_LABEL,
  type Partner,
  type PartnerStage,
} from '../../lib/types';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { Field, Input } from '../../components/Field';
import {
  LiveNumber,
  LiveSelect,
  LiveText,
  LiveTextarea,
} from '../../components/LiveField';
import { Select, optionsFrom } from '../../components/Select';
import { IconPeople, IconPlus, IconTrash } from '../../components/Icons';

/** A partner at this stage is actually sending people. */
const ACTIVE_STAGE: PartnerStage = 'referring';

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
  const { config, readOnly } = useProject();
  const { confirm, element: confirmElement } = useConfirm();
  const [county, setCounty] = useState('');
  const [kind, setKind] = useState('');
  const [stage, setStage] = useState<PartnerStage | ''>('');
  const [adding, setAdding] = useState(false);

  const configCounties = Array.isArray(config.counties)
    ? (config.counties as unknown[]).map((value) => String(value))
    : [];
  const configKinds = Array.isArray(config.partner_kinds)
    ? (config.partner_kinds as unknown[]).map((value) => String(value))
    : [];

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

  const visible = useMemo(
    () =>
      partners.filter((partner) => {
        if (county && partner.county !== county) return false;
        if (kind && partner.kind !== kind) return false;
        if (stage && partner.stage !== stage) return false;
        return true;
      }),
    [partners, county, kind, stage]
  );

  const filtered = Boolean(county || kind || stage);

  const remove = async (partner: Partner) => {
    const ok = await confirm({
      title: `Remove ${partner.name}?`,
      body: 'This removes the partner for everyone. Anything recorded about them goes with it.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    const result = await deleteRow('partners', partner.id);
    if (result.ok) toast.good('Removed.');
    else if (result.error) toast.bad(result.error.message);
  };

  return (
    <div class="wb-stack">
      <section class="wb-panel">
        <header class="wb-panel-head">
          <div>
            <h2 class="wb-panel-title">Coverage</h2>
            <p class="wb-page-sub">One reading per county: is anybody referring from there yet?</p>
          </div>
        </header>

        {coverage.length ? (
          <ul class="wb-coverage">
            {coverage.map((entry) => (
              <li class={`wb-coverage-item${entry.referring ? '' : ' is-gap'}`} key={entry.name}>
                <p class="wb-coverage-name">{entry.name}</p>
                <p class="wb-coverage-value wb-mono">
                  {entry.referrals}
                  <span class="wb-coverage-unit"> referrals</span>
                </p>
                <p class="wb-coverage-meta">
                  {entry.referring ? (
                    <Chip tone="good">
                      {entry.referring} referring
                    </Chip>
                  ) : (
                    <Chip tone="warn">No active referral source</Chip>
                  )}
                  <span class="wb-mono-soft">{plural(entry.partners, 'partner')}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No counties are set up"
            body="The counties this project serves are a project setting. An administrator can add them in Settings, and the coverage reading will appear here."
          />
        )}
      </section>

      <section class="wb-panel">
        <header class="wb-panel-head">
          <h2 class="wb-panel-title">
            Partners
            <span class="wb-panel-count wb-mono-soft"> {visible.length}</span>
          </h2>
          {readOnly || adding ? null : (
            <Button
              variant="secondary"
              size="sm"
              icon={<IconPlus size={15} />}
              onClick={() => setAdding(true)}
            >
              Add partner
            </Button>
          )}
        </header>

        {adding ? (
          <AddPartner
            partners={partners}
            counties={counties}
            kinds={kinds}
            onClose={() => setAdding(false)}
          />
        ) : null}

        <div class="wb-filters">
          {counties.length ? (
            <Select
              value={county}
              placeholder="Every county"
              options={counties.map((name) => ({ value: name, label: name }))}
              size="sm"
              aria-label="County"
              onValue={setCounty}
            />
          ) : null}
          {kinds.length ? (
            <Select
              value={kind}
              placeholder="Every kind"
              options={kinds.map((name) => ({ value: name, label: name }))}
              size="sm"
              aria-label="Kind of organisation"
              onValue={setKind}
            />
          ) : null}
          <Select<PartnerStage>
            value={stage}
            placeholder="Any stage"
            options={optionsFrom(PARTNER_STAGES, PARTNER_STAGE_LABEL)}
            size="sm"
            aria-label="Stage"
            onValue={setStage}
          />
          {filtered ? (
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setCounty('');
                setKind('');
                setStage('');
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<IconPeople size={22} />}
            title={filtered ? 'No partners match those filters' : 'No partners yet'}
            body={
              filtered
                ? 'Clear a filter to see more.'
                : readOnly
                  ? 'Nobody has been added to this project yet.'
                  : 'Add the organisations that send people your way, and everyone will see the same picture.'
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCounty('');
                    setKind('');
                    setStage('');
                  }}
                >
                  Clear filters
                </Button>
              ) : readOnly || adding ? null : (
                <Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>
                  Add the first partner
                </Button>
              )
            }
          />
        ) : (
          <div class="wb-partner-grid">
            {visible.map((partner) => (
              <article class="wb-partner" key={partner.id}>
                <header class="wb-partner-head">
                  <h3 class="wb-partner-name">{partner.name}</h3>
                  {readOnly ? null : (
                    <Button
                      variant="quiet"
                      size="sm"
                      iconOnly
                      aria-label={`Remove ${partner.name}`}
                      icon={<IconTrash size={15} />}
                      onClick={() => void remove(partner)}
                    />
                  )}
                </header>

                <p class="wb-partner-meta">
                  {partner.county ? <Chip tone="quiet">{partner.county}</Chip> : null}
                  {partner.kind ? <Chip tone="quiet">{partner.kind}</Chip> : null}
                </p>

                <div class="wb-partner-fields">
                  <LiveSelect<PartnerStage>
                    table="partners"
                    id={partner.id}
                    field="stage"
                    value={partner.stage}
                    label="Stage"
                    size="sm"
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
                </div>

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
                  rows={2}
                  placeholder="Anything worth remembering"
                  readOnly={readOnly}
                />
              </article>
            ))}
          </div>
        )}
      </section>

      {confirmElement}
    </div>
  );
}

/** The inline form for a new partner. Editors and managers only. */
function AddPartner({
  partners,
  counties,
  kinds,
  onClose,
}: {
  partners: Partner[];
  counties: string[];
  kinds: string[];
  onClose: () => void;
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
      onClose();
    } else if (result.error) {
      setError(result.error.message);
    }
  };

  return (
    <form class="wb-grant-form" onSubmit={submit}>
      <Field label="Name" required error={error}>
        {(props) => (
          <Input
            {...props}
            value={name}
            placeholder="The organisation"
            autoFocus
            onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
          />
        )}
      </Field>

      <Field label="County">
        {(props) =>
          counties.length ? (
            <Select
              {...props}
              value={county}
              placeholder="Not set"
              options={counties.map((entry) => ({ value: entry, label: entry }))}
              onValue={setCounty}
            />
          ) : (
            <Input
              {...props}
              value={county}
              onInput={(event) => setCounty((event.currentTarget as HTMLInputElement).value)}
            />
          )
        }
      </Field>

      <Field label="Kind">
        {(props) =>
          kinds.length ? (
            <Select
              {...props}
              value={kind}
              placeholder="Not set"
              options={kinds.map((entry) => ({ value: entry, label: entry }))}
              onValue={setKind}
            />
          ) : (
            <Input
              {...props}
              value={kind}
              onInput={(event) => setKind((event.currentTarget as HTMLInputElement).value)}
            />
          )
        }
      </Field>

      <div class="wb-grant-form-actions">
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving} disabled={!name.trim()}>
          Add partner
        </Button>
      </div>
    </form>
  );
}
