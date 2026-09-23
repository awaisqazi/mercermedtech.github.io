/**
 * The review demo's data. Every name, number, organisation and place in this
 * file is invented. It describes a made-up training grant ("Sample Grant") so
 * the Workbench has something realistic to lay out: about forty tasks, a
 * year and a half of monthly reports, a dozen partners and three people.
 *
 * Dates are built relative to today, so the demo always looks current: some
 * work is overdue, some is due this week, one report is next.
 *
 * This file is only ever downloaded by `#/demo`. It must never contain a real
 * person, organisation, grant, county or figure: this repository is public.
 */
import type {
  ActivityRow,
  Comment,
  Partner,
  PartnerStage,
  Profile,
  Project,
  ProjectDoc,
  ProjectMember,
  ProjectStateRow,
  Report,
  ReportStatus,
  Task,
  TaskPriority,
  TaskStatus,
  Horizon,
} from '../lib/types';

export const ME = 'demo-pat-example';
export const SAM = 'demo-sam-sample';
export const ROBIN = 'demo-robin-test';

export const PRIMARY_ID = 'demo-project-grant';
export const SIDE_ID = 'demo-project-side';
export const OLD_ID = 'demo-project-old';

export interface Fixture {
  profiles: Profile[];
  projects: Project[];
  project_members: ProjectMember[];
  tasks: Task[];
  reports: Report[];
  partners: Partner[];
  project_state: ProjectStateRow[];
  project_docs: ProjectDoc[];
  comments: Comment[];
  activity: ActivityRow[];
  invitations: unknown[];
}

/* ------------------------------------------------------------- dates --- */

function day(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

function ago(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function monthKey(offset: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthDay(offset: number, dayOfMonth: number): string {
  return `${monthKey(offset)}-${String(dayOfMonth).padStart(2, '0')}`;
}

function monthName(offset: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/* ------------------------------------------------------------ people --- */

const profiles: Profile[] = [
  {
    id: ME,
    email: 'pat@example.invalid',
    full_name: 'Pat Example',
    title: 'Program lead',
    role: 'owner',
    created_at: ago(24 * 200),
    // Two days ago, so anything the others changed since then is "new to you".
    last_seen_at: ago(50),
  },
  {
    id: SAM,
    email: 'sam@example.invalid',
    full_name: 'Sam Sample',
    title: 'Partnerships',
    role: 'admin',
    created_at: ago(24 * 190),
    last_seen_at: ago(0.1),
  },
  {
    id: ROBIN,
    email: 'robin@example.invalid',
    full_name: 'Robin Test',
    title: 'Instruction',
    role: 'member',
    created_at: ago(24 * 120),
    last_seen_at: ago(3),
  },
];

/* ---------------------------------------------------------- projects --- */

const WORKSTREAMS = [
  { key: 'outreach', label: 'Outreach' },
  { key: 'instruction', label: 'Instruction' },
  { key: 'credentials', label: 'Credentials' },
  { key: 'placement', label: 'Placement' },
  { key: 'reporting', label: 'Reporting' },
];

const COUNTIES = [
  'Alder County',
  'Birch County',
  'Cedar County',
  'Dogwood County',
  'Elm County',
  'Fir County',
  'Gum County',
];

const REPORT_CHECKS = [
  { key: 'narrative', label: 'Narrative written', short: 'Narrative' },
  { key: 'roster', label: 'Attendance roster exported', short: 'Roster' },
  { key: 'outcomes', label: 'Outcome counts checked', short: 'Outcomes' },
  { key: 'invoice', label: 'Invoice prepared', short: 'Invoice' },
  { key: 'receipts', label: 'Receipts attached', short: 'Receipts' },
  { key: 'signoff', label: 'Signed off by the program lead', short: 'Sign-off' },
  { key: 'uploaded', label: 'Uploaded to the funder portal', short: 'Uploaded' },
];

const termStart = monthDay(-7, 1);
const termEnd = monthDay(12, 28);

const grantConfig = {
  primary: true,
  funder: 'Sample Funding Agency',
  contract_no: 'SAMPLE-0000-DEMO',
  award: 480000,
  term_start: termStart,
  term_end: termEnd,
  funding_sentence:
    'This sample program is paid for by a sample grant from the Sample Funding Agency. Nothing in this demo is real.',
  targets: { enrolled: 120, credential_rate: 0.7, placement_rate: 0.6, retention_rate: 0.8 },
  milestones: {
    first_cohort_start: monthDay(-5, 6),
    last_cohort_start: monthDay(8, 1),
    closeout_report: monthDay(13, 30),
  },
  workstreams: WORKSTREAMS,
  counties: COUNTIES,
  partner_kinds: ['Library', 'Job centre', 'College', 'Community group', 'Employer'],
  report_checks: REPORT_CHECKS,
  budget_categories: [
    { name: 'People', total: 300000, rule: 'flex' as const },
    { name: 'Program costs', total: 140000, rule: 'flex' as const },
    { name: 'Administration', total: 40000, rule: 'decrease_only' as const },
  ],
  budget_lines: [
    { id: 'instructors', label: 'Instructors', category: 'People', amount: 180000 },
    { id: 'coordinator', label: 'Program coordinator', category: 'People', amount: 90000 },
    { id: 'coaching', label: 'Career coaching', category: 'People', amount: 30000 },
    { id: 'devices', label: 'Laptops and hotspots', category: 'Program costs', amount: 60000 },
    { id: 'exams', label: 'Credential exam fees', category: 'Program costs', amount: 45000 },
    { id: 'support', label: 'Travel and childcare support', category: 'Program costs', amount: 35000 },
    { id: 'admin', label: 'Administration', category: 'Administration', amount: 30000 },
    { id: 'audit', label: 'Audit', category: 'Administration', amount: 10000 },
  ],
  funnel: [
    { key: 'inquiries', label: 'Inquiries' },
    { key: 'assessed', label: 'Assessed' },
    { key: 'enrolled', label: 'Enrolled' },
    { key: 'credentialed', label: 'Credentialed' },
    { key: 'placed', label: 'Placed in work' },
    { key: 'ret90', label: 'Still in work at 90 days' },
    { key: 'exited', label: 'Left before finishing', side: true },
  ],
};

const projects: Project[] = [
  {
    id: PRIMARY_ID,
    slug: 'sample-grant',
    name: 'Sample Grant',
    kind: 'grant',
    track: 'tech',
    summary:
      'A made-up eighteen-month grant that pays for free computer skills classes, the credential exam at the end, and help finding work afterwards. It exists only so the Workbench demo has something to show.',
    status: 'active',
    config: grantConfig,
    created_by: ME,
    created_at: ago(24 * 200),
    updated_at: ago(2),
  },
  {
    id: SIDE_ID,
    slug: 'sample-open-house',
    name: 'Sample Open House',
    kind: 'general',
    track: 'org',
    summary: 'An invented one-day open house for the demo.',
    status: 'active',
    config: {},
    created_by: ME,
    created_at: ago(24 * 60),
    updated_at: ago(30),
  },
  {
    id: OLD_ID,
    slug: 'old-sample-pilot',
    name: 'Old Sample Pilot',
    kind: 'general',
    track: 'med',
    summary: 'An invented pilot that finished last year.',
    status: 'archived',
    config: {},
    created_by: ME,
    created_at: ago(24 * 500),
    updated_at: ago(24 * 90),
  },
];

const project_members: ProjectMember[] = [PRIMARY_ID, SIDE_ID, OLD_ID].flatMap((projectId) => [
  { project_id: projectId, user_id: ME, role: 'manager' as const, added_by: ME, created_at: ago(24 * 100) },
  { project_id: projectId, user_id: SAM, role: 'editor' as const, added_by: ME, created_at: ago(24 * 100) },
  { project_id: projectId, user_id: ROBIN, role: 'editor' as const, added_by: ME, created_at: ago(24 * 90) },
]);

/* ------------------------------------------------------------- tasks --- */

type TaskSeed = [
  title: string,
  ws: string,
  status: TaskStatus,
  pri: TaskPriority,
  horizon: Horizon,
  due: number | null,
  who: string | null,
  changedHoursAgo: number,
  changedBy: string,
];

const TASKS: TaskSeed[] = [
  ['Confirm the lab booking for the next cohort', 'instruction', 'doing', 'critical', 'now', -2, ME, 20, SAM],
  ['Send the signed partner letter back to the college', 'outreach', 'blocked', 'high', 'now', -1, SAM, 30, SAM],
  ['Fix the attendance export so it matches the roster', 'reporting', 'todo', 'critical', 'now', 1, ME, 6, ROBIN],
  ['Order replacement hotspots', 'instruction', 'todo', 'high', 'now', 2, ROBIN, 70, ME],
  ['Draft the monthly narrative', 'reporting', 'doing', 'high', 'now', 3, ME, 10, SAM],
  ['Call back the six people on the waiting list', 'outreach', 'todo', 'normal', 'now', 4, SAM, 90, SAM],
  ['Schedule the practice exam', 'credentials', 'todo', 'normal', 'now', 5, ROBIN, 100, ROBIN],
  ['Collect receipts for travel support', 'reporting', 'todo', 'normal', 'now', 6, null, 120, ME],
  ['Update the flyer with the new start date', 'outreach', 'doing', 'normal', 'now', null, SAM, 4, SAM],
  ['Check the laptop inventory against the list', 'instruction', 'todo', 'normal', 'now', null, ROBIN, 200, ME],
  ['Write the welcome email for new students', 'instruction', 'done', 'normal', 'now', -8, ME, 140, ME],
  ['Book the room for the employer panel', 'placement', 'todo', 'normal', 'next', 10, SAM, 160, SAM],
  ['Line up three employers for mock interviews', 'placement', 'todo', 'high', 'next', 14, SAM, 26, SAM],
  ['Prepare the credential exam voucher request', 'credentials', 'todo', 'high', 'next', 12, ROBIN, 180, ROBIN],
  ['Set up the follow-up survey at 90 days', 'placement', 'todo', 'normal', 'next', 21, ME, 220, ME],
  ['Agree the referral form with the job centre', 'outreach', 'doing', 'normal', 'next', 9, SAM, 44, SAM],
  ['Plan the second evening cohort', 'instruction', 'todo', 'normal', 'next', 25, ROBIN, 300, ROBIN],
  ['Review the budget against billing so far', 'reporting', 'todo', 'normal', 'next', 18, ME, 260, ME],
  ['Translate the intake form', 'outreach', 'todo', 'normal', 'next', null, null, 310, ME],
  ['Find a second exam site', 'credentials', 'blocked', 'normal', 'next', 16, ROBIN, 36, ROBIN],
  ['Add captions to the orientation video', 'instruction', 'todo', 'normal', 'next', null, null, 330, ME],
  ['Test the new sign-in sheet with one class', 'reporting', 'todo', 'normal', 'next', 11, ROBIN, 340, ROBIN],
  ['Write up the lessons from the first cohort', 'instruction', 'todo', 'normal', 'later', 40, ME, 400, ME],
  ['Plan the graduation event', 'placement', 'todo', 'normal', 'later', 60, SAM, 410, SAM],
  ['Draft the closeout report outline', 'reporting', 'todo', 'normal', 'later', 90, ME, 420, ME],
  ['Ask partners for quotes for the case study', 'outreach', 'todo', 'normal', 'later', null, SAM, 430, SAM],
  ['Look into a weekend cohort', 'instruction', 'todo', 'normal', 'later', null, null, 440, ME],
  ['Set up an alumni group', 'placement', 'todo', 'normal', 'later', null, null, 450, ME],
  ['Refresh the partner map', 'outreach', 'todo', 'normal', 'later', 45, SAM, 460, SAM],
  ['Archive the first cohort files', 'reporting', 'todo', 'normal', 'later', 70, ROBIN, 470, ROBIN],
  ['Order the second batch of laptops', 'instruction', 'done', 'high', 'now', -20, ROBIN, 500, ROBIN],
  ['Sign the partner agreement with the library', 'outreach', 'done', 'normal', 'now', -30, SAM, 520, SAM],
  ['Submit last month’s report', 'reporting', 'done', 'critical', 'now', -9, ME, 180, ME],
  ['Run the orientation session', 'instruction', 'done', 'normal', 'now', -15, ROBIN, 560, ROBIN],
  ['Print the certificates for the first cohort', 'credentials', 'done', 'normal', 'now', -12, ROBIN, 580, ROBIN],
  ['Set up the shared drive folders', 'reporting', 'done', 'normal', 'now', -40, ME, 600, ME],
  ['Hire the second instructor', 'instruction', 'done', 'high', 'now', -45, ME, 620, ME],
  ['Agree the placement referral with an employer', 'placement', 'doing', 'normal', 'next', 20, SAM, 15, SAM],
  ['Collect the exam results for cohort one', 'credentials', 'doing', 'high', 'now', 0, ROBIN, 8, ROBIN],
  ['Chase the missing timesheets', 'reporting', 'todo', 'high', 'now', -4, ROBIN, 3, SAM],
];

const WHY: Record<string, string> = {
  instruction: 'Classes cannot start without it, and the start date is already on the flyer.',
  outreach: 'Partners send most of our students. A slow reply costs us a cohort.',
  credentials: 'The credential rate is one of the four numbers the grant is judged on.',
  placement: 'Placement in work is what the funder pays the final milestone on.',
  reporting: 'A late or incomplete report holds up reimbursement for the month.',
};

const tasks: Task[] = TASKS.map((seed, index) => {
  const [title, ws, status, pri, horizon, due, who, changed, by] = seed;
  const id = `demo-task-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    project_id: PRIMARY_ID,
    title,
    ws,
    status,
    pri,
    horizon,
    due: due === null ? null : day(due),
    owner: '',
    assignee: who,
    why: WHY[ws] ?? '',
    done_when: index % 3 === 0 ? 'Written confirmation is saved in the project folder.' : '',
    notes: index % 4 === 0 ? 'Talked this through at the Monday check-in. **Next:** confirm by email.' : '',
    recurring: ws === 'reporting' && index % 2 === 0 ? 'Monthly' : '',
    sources:
      index % 5 === 0
        ? [{ kind: 'gdrive' as const, name: 'Sample folder', where: 'Shared drive / Sample Grant / Working files' }]
        : [],
    sort: (index + 1) * 10,
    created_by: ME,
    updated_by: by,
    created_at: ago(24 * 60 + index),
    updated_at: ago(changed),
  };
});

const sideTasks: Task[] = [
  ['Book the hall', 'doing', 'high', 'now', 5, SAM],
  ['Order name badges', 'todo', 'normal', 'now', 8, ROBIN],
  ['Write the invitation', 'done', 'normal', 'now', -3, ME],
  ['Ask two graduates to speak', 'todo', 'normal', 'next', 15, SAM],
].map(([title, status, pri, horizon, due, who], index) => ({
  id: `demo-side-task-${index + 1}`,
  project_id: SIDE_ID,
  title: String(title),
  ws: '',
  status: status as TaskStatus,
  pri: pri as TaskPriority,
  horizon: horizon as Horizon,
  due: day(Number(due)),
  owner: '',
  assignee: String(who),
  why: '',
  done_when: '',
  notes: '',
  recurring: '',
  sources: [],
  sort: (index + 1) * 10,
  created_by: ME,
  updated_by: String(who),
  created_at: ago(24 * 20),
  updated_at: ago(24 * (index + 1)),
}));

/* ----------------------------------------------------------- reports --- */

function reportFor(index: number): Report {
  // Nineteen monthly periods: the first one covers the first month of the
  // term and is due mid-way through the next; the last is the closeout.
  const offset = index - 6; // due month relative to now
  const closeout = index === 18;
  let status: ReportStatus = 'not_started';
  if (offset < -2) status = 'paid';
  else if (offset === -2) status = 'approved';
  else if (offset === -1) status = 'submitted';
  else if (offset === 0) status = 'preparing';

  const checks: Record<string, boolean> = {};
  REPORT_CHECKS.forEach((check, position) => {
    if (offset < 0) checks[check.key] = true;
    else if (offset === 0) checks[check.key] = position < 5;
  });

  return {
    id: `demo-report-${String(index + 1).padStart(2, '0')}`,
    project_id: PRIMARY_ID,
    period: monthKey(offset),
    // The one being prepared now is due in a few days, whatever today is.
    due: offset === 0 ? day(5) : monthDay(offset, 15),
    covers: closeout ? 'The whole term' : monthName(offset - 1),
    kind: closeout ? 'closeout' : 'monthly',
    status,
    checks,
    amount: offset <= 0 ? 18000 + ((index * 3517) % 9000) : null,
    submitted_on: offset < 0 ? monthDay(offset, 12) : null,
    notes: offset === 0 ? 'Waiting on the roster export before sign-off.' : '',
    sources:
      offset < 0
        ? [{ kind: 'onedrive' as const, name: `Report ${monthKey(offset)}`, where: 'Sample Grant / Reports' }]
        : [],
    updated_by: offset === 0 ? SAM : ME,
    updated_at: offset === 0 ? ago(12) : ago(24 * 30 * Math.max(1, -offset)),
  };
}

const reports: Report[] = Array.from({ length: 19 }, (_, index) => reportFor(index));

/* ---------------------------------------------------------- partners --- */

type PartnerSeed = [name: string, county: string, kind: string, stage: PartnerStage, referrals: number, hours: number];

const PARTNERS: PartnerSeed[] = [
  ['Alder Sample Library', 'Alder County', 'Library', 'referring', 14, 30],
  ['Example Job Centre', 'Alder County', 'Job centre', 'referring', 22, 5],
  ['Birch Test College', 'Birch County', 'College', 'meeting_held', 0, 50],
  ['Cedar Placeholder Library', 'Cedar County', 'Library', 'referring', 6, 80],
  ['Sample Neighbours Group', 'Cedar County', 'Community group', 'contacted', 0, 120],
  ['Dogwood Demo Works', 'Dogwood County', 'Employer', 'referring', 3, 200],
  ['Elm Example Centre', 'Elm County', 'Community group', 'not_contacted', 0, 400],
  ['Fir Fictional Library', 'Fir County', 'Library', 'paused', 1, 300],
  ['Test Trades Employer', 'Birch County', 'Employer', 'contacted', 0, 70],
  ['Placeholder Parents Network', 'Alder County', 'Community group', 'referring', 9, 26],
  ['Gum Sample Job Centre', 'Gum County', 'Job centre', 'meeting_held', 0, 100],
  ['Invented Care Home', 'Elm County', 'Employer', 'not_contacted', 0, 500],
];

const partners: Partner[] = PARTNERS.map(([name, county, kind, stage, referrals, hours], index) => ({
  id: `demo-partner-${String(index + 1).padStart(2, '0')}`,
  project_id: PRIMARY_ID,
  name,
  county,
  kind,
  stage,
  contact: `Alex Placeholder, ${kind.toLowerCase()} lead`,
  next_step:
    stage === 'referring'
      ? 'Send the next start date'
      : stage === 'meeting_held'
        ? 'Share the referral form'
        : stage === 'contacted'
          ? 'Book a first meeting'
          : 'Make first contact',
  notes: index % 3 === 0 ? 'Prefers a phone call to email.' : '',
  referrals,
  sort: (index + 1) * 10,
  updated_by: index % 2 ? SAM : ME,
  updated_at: ago(hours),
}));

/* -------------------------------------------------------------- state --- */

const project_state: ProjectStateRow[] = [
  {
    project_id: PRIMARY_ID,
    key: 'metrics',
    data: {
      inquiries: 212,
      assessed: 131,
      enrolled: 58,
      credentialed: 31,
      placed: 19,
      ret90: 12,
      exited: 7,
      as_of: day(-3),
    },
    updated_by: ROBIN,
    updated_at: ago(72),
  },
  {
    project_id: PRIMARY_ID,
    key: 'budget',
    data: {
      billed: {
        instructors: 64000,
        coordinator: 34000,
        coaching: 9000,
        devices: 41000,
        exams: 8500,
        support: 6200,
        admin: 17500,
        audit: 0,
      },
      paid: 142000,
      as_of: day(-10),
    },
    updated_by: ME,
    updated_at: ago(24 * 10),
  },
];

/* --------------------------------------------------------------- docs --- */

function doc(
  section: string,
  slug: string,
  title: string,
  body: ProjectDoc['body'],
  sort: number,
  sources: ProjectDoc['sources'] = []
): ProjectDoc {
  return {
    id: `demo-doc-${section.replace(/[^a-z]/g, '')}-${slug}`,
    project_id: PRIMARY_ID,
    section,
    slug,
    title,
    body,
    sources,
    sort,
    updated_by: ME,
    updated_at: ago(24 * 20),
  };
}

const project_docs: ProjectDoc[] = [
  doc(
    'about',
    'what',
    'What this grant is',
    [
      {
        t: 'p',
        text: 'An invented grant that pays for **free computer skills classes** for adults, the credential exam at the end, and help finding work afterwards.',
      },
      {
        t: 'p',
        text: 'Classes run in cohorts of about twenty. Each cohort meets for ten weeks, two evenings a week, and finishes with the exam.',
      },
      { t: 'note', text: 'Everything in this demo is made up. None of it describes a real grant.' },
    ],
    10,
    [{ kind: 'web', name: 'Sample program page', where: 'https://example.com/sample-program' }]
  ),
  doc(
    'about',
    'judged',
    'How it is judged',
    [
      { t: 'p', text: 'The funder looks at four numbers at closeout. Each has a target in the contract.' },
      {
        t: 'kv',
        rows: [
          ['Enrolled', '120 people over the term'],
          ['Credentialed', '70% of the people enrolled'],
          ['Placed in work', '60% of the people enrolled'],
          ['Still in work at 90 days', '80% of the people placed'],
        ],
      },
      { t: 'p', text: 'Money is paid monthly against the report. The last payment waits for the closeout report.' },
    ],
    20
  ),
  doc(
    'about',
    'deliverables',
    'The four deliverables',
    [
      {
        t: 'ul',
        items: [
          '**Recruit** through partners in all seven counties.',
          '**Teach** the ten-week course, in person, with laptops on loan.',
          '**Credential** every student who finishes, with the exam fee paid.',
          '**Place** graduates in work and check in at 90 days.',
        ],
      },
    ],
    30
  ),
  doc(
    'rulebook',
    'counts',
    'Counts only, never names',
    [
      { t: 'p', text: 'Outcome numbers are counts. Names and case numbers stay in the case system, never here.' },
      { t: 'note', text: 'If a number needs a name to make sense, it belongs somewhere else.' },
    ],
    10,
    [{ kind: 'onedrive', name: 'Sample data rules', where: 'Sample Grant / Rules' }]
  ),
  doc(
    'rulebook',
    'moving-money',
    'Moving money between lines',
    [
      { t: 'p', text: 'People and Program costs can move up or down by up to ten percent without asking.' },
      { t: 'p', text: 'Administration can only go down. Anything else needs a written request first.' },
    ],
    20
  ),
  doc(
    'rulebook',
    'reports',
    'What a monthly report needs',
    [
      {
        t: 'ul',
        items: [
          'A short narrative of the month.',
          'The attendance roster.',
          'The outcome counts as of the last day of the month.',
          'An invoice with receipts for anything over the sample limit.',
        ],
      },
      { t: 'p', text: 'Reports are due on the fifteenth of the following month.' },
    ],
    30,
    [{ kind: 'gmail', name: 'Sample guidance email', where: 'Inbox / Sample Funding Agency' }]
  ),
  doc(
    'notes:reports',
    'how',
    'How we build a report',
    [{ t: 'p', text: 'Start from last month’s file, update the counts, then ask for sign-off.' }],
    10
  ),
];

/* ----------------------------------------------------------- comments --- */

const comments: Comment[] = [
  {
    id: 'demo-comment-1',
    project_id: PRIMARY_ID,
    entity: 'task',
    entity_id: 'demo-task-01',
    body: 'The lab is free on Tuesdays and Thursdays. Holding both for now.',
    user_id: SAM,
    created_at: ago(20),
  },
  {
    id: 'demo-comment-2',
    project_id: PRIMARY_ID,
    entity: 'task',
    entity_id: 'demo-task-01',
    body: 'Thanks. I will confirm once the instructor replies.',
    user_id: ME,
    created_at: ago(18),
  },
  {
    id: 'demo-comment-3',
    project_id: PRIMARY_ID,
    entity: 'report',
    entity_id: 'demo-report-07',
    body: 'Roster is nearly there, two classes still to export.',
    user_id: ROBIN,
    created_at: ago(9),
  },
  {
    id: 'demo-comment-4',
    project_id: PRIMARY_ID,
    entity: 'partner',
    entity_id: 'demo-partner-02',
    body: 'They asked for twenty more flyers.',
    user_id: SAM,
    created_at: ago(5),
  },
];

/* ----------------------------------------------------------- activity --- */

const ACTIVITY: Array<[hours: number, who: string, entity: string, entityId: string, action: ActivityRow['action'], summary: string]> = [
  [0.5, SAM, 'task', 'demo-task-40', 'updated', 'Assigned to Robin Test'],
  [3, SAM, 'task', 'demo-task-40', 'updated', 'Priority: Normal → High'],
  [4, SAM, 'task', 'demo-task-09', 'updated', 'Edited notes'],
  [5, SAM, 'partner', 'demo-partner-02', 'updated', 'Referrals: 20 → 22'],
  [6, ROBIN, 'task', 'demo-task-03', 'updated', 'Priority: High → Critical'],
  [8, ROBIN, 'task', 'demo-task-39', 'updated', 'Status: To do → Doing'],
  [9, ROBIN, 'comment', 'demo-comment-3', 'commented', 'Commented on report ' + monthKey(0)],
  [10, SAM, 'task', 'demo-task-05', 'updated', 'Edited details'],
  [12, SAM, 'report', 'demo-report-07', 'updated', 'Status: Not started → Preparing'],
  [15, SAM, 'task', 'demo-task-38', 'updated', 'Status: To do → Doing'],
  [20, SAM, 'task', 'demo-task-01', 'updated', 'Status: To do → Doing'],
  [26, SAM, 'task', 'demo-task-13', 'created', 'Added "Line up three employers for mock interviews"'],
  [30, SAM, 'task', 'demo-task-02', 'updated', 'Status: Doing → Blocked'],
  [30, SAM, 'partner', 'demo-partner-01', 'updated', 'Stage: Meeting held → Referring'],
  [36, ROBIN, 'task', 'demo-task-20', 'updated', 'Status: To do → Blocked'],
  [44, SAM, 'task', 'demo-task-16', 'updated', 'Status: To do → Doing'],
  [60, ME, 'task', 'demo-task-04', 'updated', 'Assigned to Robin Test'],
  [72, ROBIN, 'state', PRIMARY_ID, 'updated', 'Updated the outcome numbers'],
  [90, SAM, 'task', 'demo-task-06', 'created', 'Added "Call back the six people on the waiting list"'],
  [100, ROBIN, 'task', 'demo-task-07', 'created', 'Added "Schedule the practice exam"'],
  [180, ME, 'task', 'demo-task-33', 'updated', 'Status: Doing → Done'],
  [200, ME, 'report', 'demo-report-06', 'updated', 'Status: Preparing → Submitted'],
  [240, ME, 'state', PRIMARY_ID, 'updated', 'Updated what has been billed'],
];

const activity: ActivityRow[] = ACTIVITY.map(([hours, who, entity, entityId, action, summary], index) => ({
  id: 5000 - index,
  project_id: PRIMARY_ID,
  user_id: who,
  entity,
  entity_id: entityId,
  action,
  summary,
  created_at: ago(hours),
}));

export function buildFixture(): Fixture {
  // Fresh copies, so a reload starts from the same place.
  return JSON.parse(
    JSON.stringify({
      profiles,
      projects,
      project_members,
      tasks: [...tasks, ...sideTasks],
      reports,
      partners,
      project_state,
      project_docs,
      comments,
      activity,
      invitations: [],
    })
  ) as Fixture;
}
