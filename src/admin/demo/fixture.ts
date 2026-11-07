/**
 * The review demo's data. Every name, project, task and sentence in this file
 * is invented: three made-up colleagues, three made-up projects, a few weeks
 * of ordinary work. It exists so every screen has something realistic to lay
 * out, including the awkward cases (overdue work, a blocked task, a closed
 * month, an empty checklist).
 *
 * Dates are built relative to today, so the demo always looks current.
 *
 * This file is only ever downloaded by `#/demo`. It must never contain a real
 * person, organisation, grant or figure: this repository is public.
 */
import type {
  ActivityRow,
  HoursMonth,
  Inquiry,
  Invitation,
  Permission,
  Profile,
  Project,
  Role,
  Task,
  TaskComment,
  TaskItem,
  TaskPriority,
  TaskStatus,
  TimeEntry,
} from '../lib/types';
import { PERMISSION_KEYS } from '../lib/types';

/* -------------------------------------------------------------- people --- */

/** The administrator the demo signs in as by default. */
export const PAT = 'demo-person-pat';
/** A team member. */
export const SAM = 'demo-person-sam';
/** The finance person. */
export const ROBIN = 'demo-person-robin';

export const PROJECT_MED = 'demo-project-lab';
export const PROJECT_TECH = 'demo-project-web';
export const PROJECT_ORG = 'demo-project-ops';

export interface Fixture {
  roles: Role[];
  profiles: Profile[];
  invitations: Invitation[];
  projects: Project[];
  tasks: Task[];
  task_items: TaskItem[];
  task_comments: TaskComment[];
  time_entries: TimeEntry[];
  hours_months: HoursMonth[];
  activity: ActivityRow[];
  inquiries: Inquiry[];
}

/* --------------------------------------------------------------- dates --- */

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

/** Noon on a day offset, as an instant, so "logged at" times look plausible. */
function at(offset: number, hour = 12): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function firstOfMonth(offset: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/** A small seeded generator, so a reload lays out the same demo. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/* --------------------------------------------------------------- roles --- */

const ALL = [...PERMISSION_KEYS] as Permission[];

const ROLE_SEED: Array<[key: string, name: string, description: string, permissions: Permission[]]> = [
  ['owner', 'Owner', 'Runs the workspace. Cannot be edited or removed.', ALL],
  ['administrator', 'Administrator', 'Everything the owner can do, apart from handing out the owner role.', ALL],
  [
    'technology_lead',
    'Technology lead',
    'Looks after the class site, the laptops and the projects.',
    [
      'tasks.create',
      'tasks.assign',
      'tasks.edit_any',
      'tasks.delete',
      'hours.log',
      'hours.view_all',
      'projects.manage',
      'inquiries.view',
      'inquiries.manage',
    ],
  ],
  ['instructor', 'Instructor', 'Teaches the classes.', ['tasks.create', 'tasks.assign', 'hours.log', 'inquiries.view']],
  [
    'course_designer',
    'Course designer',
    'Writes and updates the course material.',
    ['tasks.create', 'tasks.assign', 'hours.log', 'inquiries.view'],
  ],
  [
    'finance',
    'Finance',
    'Checks the hours and closes each month.',
    ['tasks.create', 'tasks.assign', 'hours.log', 'hours.view_all', 'hours.edit_any', 'hours.close', 'hours.export'],
  ],
  ['member', 'Team member', 'The starting role for a new invitation.', ['tasks.create', 'hours.log']],
];

const roles: Role[] = ROLE_SEED.map(([key, name, description, permissions], index) => ({
  id: `demo-role-${key}`,
  key,
  name,
  description,
  permissions,
  is_system: key === 'owner',
  sort: (index + 1) * 10,
  created_at: ago(24 * 120),
  updated_at: ago(24 * 120),
}));

const roleId = (key: string) => `demo-role-${key}`;

const profiles: Profile[] = [
  {
    id: PAT,
    email: 'pat@example.invalid',
    full_name: 'Pat Example',
    title: 'Program administrator',
    role_id: roleId('administrator'),
    active: true,
    created_at: ago(24 * 200),
    last_seen_at: ago(20),
  },
  {
    id: SAM,
    email: 'sam@example.invalid',
    full_name: 'Sam Sample',
    title: 'Classroom assistant',
    role_id: roleId('member'),
    active: true,
    created_at: ago(24 * 90),
    last_seen_at: ago(1),
  },
  {
    id: ROBIN,
    email: 'robin@example.invalid',
    full_name: 'Robin Test',
    title: 'Bookkeeper',
    role_id: roleId('finance'),
    active: true,
    created_at: ago(24 * 60),
    last_seen_at: ago(3),
  },
];

const invitations: Invitation[] = [
  {
    id: 'demo-invite-1',
    token: 'demo-invite-token-one',
    email: 'new.colleague@example.invalid',
    role_id: roleId('instructor'),
    note: 'For the evening class',
    invited_by: PAT,
    created_at: ago(30),
    expires_at: at(13),
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
  },
  {
    id: 'demo-invite-2',
    token: 'demo-invite-token-two',
    email: null,
    role_id: roleId('member'),
    note: null,
    invited_by: PAT,
    created_at: ago(24 * 5),
    expires_at: at(9),
    accepted_at: null,
    accepted_by: null,
    revoked_at: null,
  },
];

/* ------------------------------------------------------------ projects --- */

const projects: Project[] = [
  {
    id: PROJECT_MED,
    name: 'Clinical skills lab',
    code: 'LAB',
    track: 'med',
    summary: 'Setting up and running the practice lab for the medical courses.',
    status: 'active',
    lead_id: SAM,
    sort: 10,
    created_by: PAT,
    updated_by: PAT,
    created_at: ago(24 * 100),
    updated_at: ago(24 * 10),
  },
  {
    id: PROJECT_TECH,
    name: 'Class website',
    code: 'WEB',
    track: 'tech',
    summary: 'The course site learners sign in to: lessons, quizzes and accounts.',
    status: 'active',
    lead_id: PAT,
    sort: 20,
    created_by: PAT,
    updated_by: PAT,
    created_at: ago(24 * 100),
    updated_at: ago(24 * 4),
  },
  {
    id: PROJECT_ORG,
    name: 'Office and admin',
    code: 'OPS',
    track: 'org',
    summary: 'Scheduling, supplies, paperwork and everything that keeps the doors open.',
    status: 'active',
    lead_id: ROBIN,
    sort: 30,
    created_by: PAT,
    updated_by: PAT,
    created_at: ago(24 * 100),
    updated_at: ago(24 * 20),
  },
];

/* --------------------------------------------------------------- tasks --- */

type Seed = [
  title: string,
  project: string | null,
  status: TaskStatus,
  priority: TaskPriority,
  assignee: string | null,
  due: number | null,
  progress: number,
  checklist: string[],
  doneChecks: number,
  description: string,
];

const TASKS: Seed[] = [
  ['Order replacement blood pressure cuffs', PROJECT_MED, 'doing', 'high', SAM, 2, 0, ['Count what is broken', 'Get two quotes', 'Place the order'], 2, 'Three of the adult cuffs no longer hold pressure. **Order the same model** so the practice sheets still match.'],
  ['Write the lab safety walkthrough', PROJECT_MED, 'todo', 'normal', SAM, 9, 0, ['Draft', 'Review with Pat', 'Print and laminate'], 0, 'One page, posted by the sink. Plain steps, large type.'],
  ['Label the supply drawers', PROJECT_MED, 'done', 'normal', SAM, -6, 0, ['Make the labels', 'Stick them on'], 2, ''],
  ['Book the eye wash station inspection', PROJECT_MED, 'blocked', 'urgent', PAT, -2, 0, [], 0, 'Waiting on the building manager to confirm a date. **Due before the next class starts.**'],
  ['Restock gloves and gowns', PROJECT_MED, 'todo', 'normal', null, 4, 0, [], 0, 'Medium and large gloves are low. Gowns are fine until next month.'],
  ['Set up the practice phlebotomy arm', PROJECT_MED, 'doing', 'normal', SAM, 6, 40, [], 0, 'The new arm arrived. Needs the replacement veins fitted and a test run.'],
  ['Move quiz 3 to the new question format', PROJECT_TECH, 'doing', 'high', PAT, 1, 0, ['Copy the questions', 'Check the answers', 'Turn on the timer', 'Try it as a learner'], 3, 'The old format does not show which answer was right. Learners asked for that.'],
  ['Fix the password reset email wording', PROJECT_TECH, 'todo', 'normal', PAT, 3, 0, [], 0, 'The email says "click here" twice. Make it one plain sentence with the link.'],
  ['Add captions to the week 2 videos', PROJECT_TECH, 'todo', 'high', SAM, -1, 0, ['Video 1', 'Video 2', 'Video 3', 'Video 4', 'Video 5'], 1, ''],
  ['Check the site on a small phone', PROJECT_TECH, 'done', 'normal', PAT, -3, 0, ['Sign in', 'Open a lesson', 'Take a quiz'], 3, 'Everything works at 375px. The quiz timer overlaps the title on one page; fixed.'],
  ['Make learner accounts for the new class', PROJECT_TECH, 'todo', 'urgent', PAT, 5, 0, ['Get the class list', 'Create the accounts', 'Print the sign-in cards'], 0, ''],
  ['Back up the course site', PROJECT_TECH, 'done', 'normal', PAT, -10, 0, [], 0, 'Monthly backup. Stored in the usual place.'],
  ['Replace the broken laptop charger', PROJECT_TECH, 'todo', 'normal', null, 12, 0, [], 0, 'Laptop 7. Same charger model as the others.'],
  ['Draft the lesson on online forms', PROJECT_TECH, 'blocked', 'normal', SAM, 8, 30, [], 0, 'Waiting for the screenshots from the class site before the examples can be finished.'],
  ['Send the monthly hours summary', PROJECT_ORG, 'todo', 'high', ROBIN, 3, 0, ['Check every entry has a summary', 'Close the month', 'Send the summary'], 1, ''],
  ['Renew the copier lease', PROJECT_ORG, 'doing', 'normal', ROBIN, 14, 50, [], 0, 'The lease ends next month. Ask for the same terms.'],
  ['Update the front desk sign-in sheet', PROJECT_ORG, 'done', 'normal', SAM, -4, 0, [], 0, ''],
  ['Plan the open house', PROJECT_ORG, 'todo', 'normal', PAT, 20, 0, ['Pick a date', 'Book the room', 'Write the flyer', 'Order coffee'], 1, 'An evening open house for people asking about the next class.'],
  ['File last month receipts', PROJECT_ORG, 'done', 'normal', ROBIN, -8, 0, ['Scan', 'File', 'Shred the copies'], 3, ''],
  ['Check the first aid kit', PROJECT_ORG, 'todo', 'normal', null, -3, 0, [], 0, 'Monthly check. Replace anything out of date.'],
  ['Write the welcome note for new staff', null, 'todo', 'normal', PAT, null, 0, [], 0, 'Where things are, who to ask, how to log hours.'],
  ['Clear out the storage room', null, 'todo', 'normal', null, null, 0, [], 0, ''],
  ['Reply to the supply catalogue question', PROJECT_ORG, 'doing', 'normal', ROBIN, 0, 0, [], 0, 'They want to know which account to bill. Check with Pat first.'],
  ['Test the new projector', PROJECT_TECH, 'todo', 'normal', SAM, 7, 0, ['HDMI', 'Wireless', 'Sound'], 0, ''],
  ['Archive the old course pages', PROJECT_TECH, 'done', 'normal', PAT, -1, 0, [], 0, 'Moved to the archive section, still readable, no longer in the menu.'],
];

const tasks: Task[] = [];
const task_items: TaskItem[] = [];

TASKS.forEach(([title, project, status, priority, assignee, due, progress, checklist, doneChecks, description], index) => {
  const id = `demo-task-${String(index + 1).padStart(2, '0')}`;
  const creator = assignee === ROBIN ? ROBIN : PAT;
  const created = ago(24 * (30 - (index % 20)));
  tasks.push({
    id,
    project_id: project,
    title,
    description,
    status,
    priority,
    assignee_id: assignee,
    due: due === null ? null : day(due),
    progress: checklist.length ? Math.round((doneChecks / checklist.length) * 100) : status === 'done' ? 100 : progress,
    done_at: status === 'done' ? ago(24 * (2 + (index % 6))) : null,
    sort: (index + 1) * 10,
    created_by: creator,
    updated_by: assignee ?? creator,
    created_at: created,
    updated_at: ago(2 + index * 3),
  });
  checklist.forEach((text, itemIndex) => {
    task_items.push({
      id: `${id}-item-${itemIndex + 1}`,
      task_id: id,
      text,
      done: itemIndex < doneChecks,
      sort: (itemIndex + 1) * 10,
      created_by: creator,
      updated_by: assignee ?? creator,
      created_at: created,
      updated_at: ago(2 + index * 3),
    });
  });
});

const COMMENTS: Array<[task: number, who: string, hours: number, body: string]> = [
  [1, SAM, 30, 'Two quotes in. The second is cheaper but ships in three weeks.'],
  [1, PAT, 26, 'Go with the faster one. We need them before the next skills check.'],
  [4, PAT, 50, 'Called the building manager again. They will confirm by Friday.'],
  [4, ROBIN, 20, 'If it slips past the class start, let me know and I will move the invoice.'],
  [7, PAT, 8, 'Questions 1 to 9 are moved. The timer needs a second look.'],
  [9, SAM, 12, 'Video 1 is done. The rest need the transcripts first.'],
  [9, PAT, 6, 'The transcripts are in the shared folder now.'],
  [14, SAM, 40, 'Stuck until the screenshots exist. Moving on to the captions meanwhile.'],
  [15, ROBIN, 5, 'Two entries from last week have no summary. I have asked both people.'],
  [18, PAT, 70, 'Thinking of a Thursday evening. Any objections?'],
  [18, SAM, 66, 'Thursday works for me.'],
  [23, ROBIN, 3, '**Waiting on Pat** for the account name.'],
];

const task_comments: TaskComment[] = COMMENTS.map(([task, who, hours, body], index) => ({
  id: `demo-comment-${index + 1}`,
  task_id: `demo-task-${String(task).padStart(2, '0')}`,
  user_id: who,
  body,
  created_at: ago(hours),
}));

/* ------------------------------------------------------------- hours --- */

const SUMMARIES: Record<string, Array<[project: string | null, task: number | null, summary: string]>> = {
  [PAT]: [
    [PROJECT_TECH, 7, 'Moved quiz questions to the new format'],
    [PROJECT_TECH, 10, 'Checked the class site on a small phone'],
    [PROJECT_TECH, null, 'Answered learner sign-in questions'],
    [PROJECT_ORG, 18, 'Planned the open house date and room'],
    [PROJECT_ORG, null, 'Weekly team check-in'],
    [PROJECT_MED, 4, 'Chased the eye wash inspection'],
    [null, 21, 'Wrote part of the welcome note'],
    [PROJECT_TECH, 11, 'Got the class list ready for new accounts'],
  ],
  [SAM]: [
    [PROJECT_MED, 1, 'Compared quotes for blood pressure cuffs'],
    [PROJECT_MED, 6, 'Fitted the veins on the practice arm'],
    [PROJECT_MED, 3, 'Labelled the supply drawers'],
    [PROJECT_TECH, 9, 'Captioned week 2 video 1'],
    [PROJECT_MED, null, 'Ran the morning skills practice'],
    [PROJECT_ORG, 17, 'Updated the front desk sign-in sheet'],
    [PROJECT_TECH, 14, 'Drafted the online forms lesson outline'],
    [PROJECT_ORG, null, 'Covered the front desk'],
  ],
  [ROBIN]: [
    [PROJECT_ORG, 15, 'Checked last week of hours entries'],
    [PROJECT_ORG, 19, 'Scanned and filed receipts'],
    [PROJECT_ORG, 16, 'Read through the copier lease terms'],
    [PROJECT_ORG, 23, 'Replied to the supply catalogue'],
    [PROJECT_ORG, null, 'Reconciled the petty cash'],
    [PROJECT_ORG, null, 'Paid the monthly invoices'],
  ],
};

const time_entries: TimeEntry[] = [];
{
  const random = seeded(7);
  let count = 0;
  // Three full weeks back to today, weekdays only.
  for (let offset = -21; offset <= 0; offset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const person of [PAT, SAM, ROBIN]) {
      // Finance works three days a week; everyone misses the odd day.
      if (person === ROBIN && (weekday === 2 || weekday === 4)) continue;
      if (random() < 0.12) continue;
      const choices = SUMMARIES[person]!;
      const pieces = random() < 0.45 ? 2 : 1;
      const dayTotal = person === ROBIN ? 4 + Math.round(random() * 8) / 4 : 5 + Math.round(random() * 12) / 4;
      for (let piece = 0; piece < pieces; piece += 1) {
        const [project, task, summary] = choices[Math.floor(random() * choices.length)]!;
        const hours = pieces === 1 ? dayTotal : piece === 0 ? Math.round(dayTotal * 2.4) / 4 : dayTotal - Math.round(dayTotal * 2.4) / 4;
        count += 1;
        time_entries.push({
          id: `demo-entry-${String(count).padStart(3, '0')}`,
          user_id: person,
          work_date: day(offset),
          hours: Math.max(0.25, Math.round(hours * 4) / 4),
          project_id: project,
          task_id: task === null ? null : `demo-task-${String(task).padStart(2, '0')}`,
          summary,
          created_by: person,
          updated_by: person,
          created_at: at(offset, 17),
          updated_at: at(offset, 17),
        });
      }
    }
  }
}

// Today always has entries for all three people, whatever the weekday, so
// "Today on the team" is never empty. Generated entries for today are replaced.
{
  const today = day(0);
  const mine: Array<[string, number, string, string | null, string]> = [
    [PAT, 2.5, PROJECT_TECH, 'demo-task-07', 'Moved quiz 3 questions to the new format'],
    [SAM, 3, PROJECT_MED, 'demo-task-01', 'Compared quotes for blood pressure cuffs'],
    [ROBIN, 1.5, PROJECT_ORG, null, 'Checked hours entries for missing summaries'],
  ];
  for (let index = time_entries.length - 1; index >= 0; index -= 1) {
    if (time_entries[index]!.work_date === today) time_entries.splice(index, 1);
  }
  mine.forEach(([person, hours, project, task, summary], index) => {
    time_entries.push({
      id: `demo-entry-today-${index + 1}`,
      user_id: person,
      work_date: today,
      hours,
      project_id: project,
      task_id: task,
      summary,
      created_by: person,
      updated_by: person,
      created_at: at(0, 9),
      updated_at: at(0, 9),
    });
  });
}

/** Last month is closed, so its entries show the lock. */
const hours_months: HoursMonth[] = [
  { month: firstOfMonth(-1), closed_by: ROBIN, closed_at: at(-new Date().getDate() + 3, 10), note: 'Checked against the timesheets.' },
];

/* ------------------------------------------------------------ activity --- */

const ACTIVITY: Array<[hours: number, who: string, entity: ActivityRow['entity'], task: number | null, action: ActivityRow['action'], summary: string]> = [
  [0.4, SAM, 'task_item', 1, 'updated', 'Ticked "Get two quotes"'],
  [0.8, ROBIN, 'comment', 23, 'commented', 'Commented on "Reply to the supply catalogue question"'],
  [1.5, PAT, 'task', 7, 'updated', 'Status: To do → In progress'],
  [2, SAM, 'time_entry', null, 'created', 'Logged 3.5 h on LAB'],
  [3, PAT, 'task', 11, 'updated', 'Priority: High → Urgent'],
  [4, ROBIN, 'time_entry', null, 'created', 'Logged 4 h on OPS'],
  [5, ROBIN, 'comment', 15, 'commented', 'Commented on "Send the monthly hours summary"'],
  [6, PAT, 'comment', 9, 'commented', 'Commented on "Add captions to the week 2 videos"'],
  [7, PAT, 'task', 25, 'updated', 'Status: In progress → Done'],
  [8, PAT, 'comment', 7, 'commented', 'Commented on "Move quiz 3 to the new question format"'],
  [9, SAM, 'task', 9, 'updated', 'Assigned to Sam Sample'],
  [11, PAT, 'task_item', 7, 'updated', 'Ticked "Check the answers"'],
  [12, SAM, 'comment', 9, 'commented', 'Commented on "Add captions to the week 2 videos"'],
  [14, PAT, 'task', 8, 'created', 'Created "Fix the password reset email wording"'],
  [18, SAM, 'time_entry', null, 'created', 'Logged 2.25 h on WEB'],
  [20, ROBIN, 'comment', 4, 'commented', 'Commented on "Book the eye wash station inspection"'],
  [22, PAT, 'time_entry', null, 'created', 'Logged 6 h on WEB'],
  [24, SAM, 'task', 17, 'updated', 'Status: In progress → Done'],
  [26, PAT, 'comment', 1, 'commented', 'Commented on "Order replacement blood pressure cuffs"'],
  [27, PAT, 'task', 4, 'updated', 'Status: In progress → Blocked'],
  [30, SAM, 'comment', 1, 'commented', 'Commented on "Order replacement blood pressure cuffs"'],
  [32, PAT, 'invitation', null, 'created', 'Invited someone as Instructor'],
  [36, ROBIN, 'task', 16, 'updated', 'Due: none → in two weeks'],
  [40, SAM, 'comment', 14, 'commented', 'Commented on "Draft the lesson on online forms"'],
  [41, SAM, 'task', 14, 'updated', 'Status: In progress → Blocked'],
  [44, PAT, 'project', null, 'updated', 'Changed the summary of WEB'],
  [48, PAT, 'task', 10, 'updated', 'Status: In progress → Done'],
  [50, PAT, 'comment', 4, 'commented', 'Commented on "Book the eye wash station inspection"'],
  [54, SAM, 'task_item', 3, 'updated', 'Ticked "Stick them on"'],
  [60, ROBIN, 'task', 19, 'updated', 'Status: In progress → Done'],
  [66, SAM, 'comment', 18, 'commented', 'Commented on "Plan the open house"'],
  [70, PAT, 'comment', 18, 'commented', 'Commented on "Plan the open house"'],
  [72, PAT, 'task', 18, 'created', 'Created "Plan the open house"'],
  [80, PAT, 'role', null, 'updated', 'Changed what Technology lead allows'],
  [90, ROBIN, 'month', null, 'closed', 'Closed last month'],
  [96, PAT, 'task', 21, 'created', 'Created "Write the welcome note for new staff"'],
  [110, SAM, 'task', 6, 'updated', 'Progress: 20% → 40%'],
  [120, PAT, 'profile', null, 'updated', 'Changed Robin Test to Finance'],
  [130, PAT, 'task', 12, 'updated', 'Status: To do → Done'],
  [140, PAT, 'project', null, 'created', 'Created project OPS'],
];

const activity: ActivityRow[] = ACTIVITY.map(([hours, who, entity, task, action, summary], index) => {
  const taskId = task === null ? null : `demo-task-${String(task).padStart(2, '0')}`;
  return {
    id: 5000 - index,
    actor_id: who,
    entity,
    entity_id: entity === 'task' ? taskId : null,
    task_id: entity === 'task' || entity === 'task_item' || entity === 'comment' ? taskId : null,
    subject_id: entity === 'time_entry' ? who : null,
    action,
    summary,
    created_at: ago(hours),
  };
});

/* ----------------------------------------------------------- inquiries --- */

type InquirySeed = [
  hours: number,
  source: Inquiry['source'],
  lang: Inquiry['lang'],
  name: string,
  contact: string,
  status: Inquiry['status'],
  assignee: string | null,
  task: number | null,
  notes: string,
  fields: Array<[string, string]>,
];

const INQUIRIES: InquirySeed[] = [
  [1.2, 'dlt_interest', 'en', 'Jordan Placeholder', '555-0101 · jordan@example.invalid', 'new', null, null, '', [['Name', 'Jordan Placeholder'], ['Phone', '555-0101'], ['Email', 'jordan@example.invalid'], ['Best time to call', 'Mornings']]],
  [5, 'inquiry', 'en', 'Casey Sample', 'casey@example.invalid', 'new', null, null, '', [['Name', 'Casey Sample'], ['Email', 'casey@example.invalid'], ['Program', 'Medical assistant'], ['Message', 'When does the next class start?']]],
  [20, 'dlt_signup', 'es', 'Alex Ejemplo', '555-0102', 'new', null, null, '', [['Nombre', 'Alex Ejemplo'], ['Teléfono', '555-0102'], ['Sesión', 'Martes por la tarde']]],
  [30, 'inquiry', 'en', 'Morgan Test', '555-0103 · morgan@example.invalid', 'contacted', PAT, 11, 'Called back. Wants the evening class. Sent the dates.', [['Name', 'Morgan Test'], ['Phone', '555-0103'], ['Email', 'morgan@example.invalid'], ['Program', 'Phlebotomy'], ['Message', 'Do you have evening classes?']]],
  [52, 'dlt_interest', 'en', 'Riley Invented', 'riley@example.invalid', 'contacted', SAM, null, 'Left a voicemail on Tuesday.', [['Name', 'Riley Invented'], ['Email', 'riley@example.invalid'], ['Best time to call', 'After 5']]],
  [80, 'dlt_signup', 'en', 'Taylor Madeup', '555-0104', 'enrolled', null, null, 'Starts with the next class.', [['Name', 'Taylor Madeup'], ['Phone', '555-0104'], ['Session', 'Thursday morning']]],
  [120, 'inquiry', 'es', 'Sam Ficticio', 'sam.f@example.invalid', 'closed', null, null, 'Asked about a program we do not run. Pointed elsewhere.', [['Nombre', 'Sam Ficticio'], ['Correo', 'sam.f@example.invalid'], ['Mensaje', '¿Tienen clases de soldadura?']]],
  [150, 'dlt_interest', 'en', 'Avery Notreal', '555-0105', 'closed', null, null, 'No longer interested.', [['Name', 'Avery Notreal'], ['Phone', '555-0105']]],
];

const inquiries: Inquiry[] = INQUIRIES.map(([hours, source, lang, name, contact, status, assignee, task, notes, fields], index) => ({
  id: `demo-inquiry-${index + 1}`,
  source,
  received_at: ago(hours),
  lang,
  page: source === 'inquiry' ? (lang === 'es' ? '/es/' : '/') : lang === 'es' ? '/es/digital-literacy/' : '/digital-literacy/',
  name,
  contact,
  fields: fields.map(([k, v]) => ({ k, v })),
  status,
  assignee_id: assignee,
  notes,
  task_id: task === null ? null : `demo-task-${String(task).padStart(2, '0')}`,
  updated_by: assignee,
  updated_at: status === 'new' ? null : ago(hours - 1),
}));

/* ----------------------------------------------------------------- all --- */

export function buildFixture(): Fixture {
  // Fresh copies each time, so the in-memory database can be written to freely.
  const copy = <T>(rows: T[]): T[] => rows.map((row) => JSON.parse(JSON.stringify(row)) as T);
  return {
    roles: copy(roles),
    profiles: copy(profiles),
    invitations: copy(invitations),
    projects: copy(projects),
    tasks: copy(tasks),
    task_items: copy(task_items),
    task_comments: copy(task_comments),
    time_entries: copy(time_entries),
    hours_months: copy(hours_months),
    activity: copy(activity),
    inquiries: copy(inquiries),
  };
}
