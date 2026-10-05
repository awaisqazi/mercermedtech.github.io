/**
 * Field specs for the two unlisted staff forms, /iep/ and /loaner/.
 *
 * FORM CONTRACT (external, do not improvise)
 * ------------------------------------------
 * Each page renders these fields as a native site form and posts them, with a
 * Turnstile token, to the mmt-signup Worker (/iep-submit, /loaner-submit). The
 * Worker forwards the entry.* fields to the Google Form's formResponse URL
 * (Worker variables IEP_FORM_ACTION, LOANER_FORM_ACTION). The Google Form
 * addresses never appear on the page.
 *
 * - `entry` is the Google Form question's entry id. Read from the forms'
 *   public data on 2026-10-04; recorded in
 *   MMT Management WorkSpace/Participants/IEP intake/README.md.
 * - Choice `value`s are the exact strings Google stores (several are
 *   bilingual, "Yes / Sí"). Google throws away a value it does not know, and
 *   the school's Apps Script reads the English half, so never translate a
 *   value: translate the label only.
 * - Checkbox questions send the same entry name once per ticked box. The
 *   "Other" box sends __other_option__ plus entry.N.other_option_response.
 * - A date question is sent as entry.N_year, entry.N_month, entry.N_day.
 *
 * scripts/check-form-contract.mjs checks the built pages against this file.
 */

export type Bilingual = { en: string; es: string };

export interface Choice {
  value: string;
  label: Bilingual;
}

export interface Field {
  entry: string;
  kind: 'text' | 'tel' | 'email' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'scale' | 'date' | 'consent';
  label: Bilingual;
  help?: Bilingual;
  required?: boolean;
  autocomplete?: string;
  choices?: Choice[];
  /** Checkbox only: adds an "Other" box with a text box. */
  other?: boolean;
  /** Scale only: words under 1 and 5. */
  scaleLabels?: [Bilingual, Bilingual];
  /** Lays two short fields side by side on wide screens. */
  half?: boolean;
}

/** One step of the stepped form. */
export interface Section {
  title: Bilingual;
  help?: Bilingual;
  fields: Field[];
  /**
   * The last step: shows a summary of every earlier answer (with Edit links)
   * above its own fields, the Turnstile check and the submit button.
   */
  review?: boolean;
}

export interface StaffForm {
  id: string;
  /** Worker route, relative to the Worker origin. */
  route: string;
  sections: Section[];
}

export const WORKER_ORIGIN = 'https://mmt-signup.mercermedtech.workers.dev';

/** Choice whose stored value is the bilingual "English / Español" string. */
const bi = (value: string): Choice => {
  const [en, es] = value.split(' / ');
  return { value, label: { en, es: es ?? en } };
};
/** Choice that reads the same in both languages. */
const same = (value: string): Choice => ({ value, label: { en: value, es: value } });

const YES_NO = [bi('Yes / Sí'), same('No')];
const COHORTS: Choice[] = [
  { value: 'Cohort 1 (Oct 2026)', label: { en: 'Cohort 1 (October 2026)', es: 'Grupo 1 (octubre de 2026)' } },
  { value: 'Cohort 2 (TBA)', label: { en: 'Cohort 2 (dates to come)', es: 'Grupo 2 (fechas por anunciar)' } },
];

/* ------------------------------------------------------------------ */
/* IEP intake                                                          */
/* ------------------------------------------------------------------ */

/** Every IEP question, grouped as in the Google Form. The steps below pick from it. */
const IEP_QUESTIONS: Section[] = [
    {
      title: { en: 'About you', es: 'Sobre usted' },
      fields: [
        { entry: 'entry.379282059', kind: 'text', required: true, autocomplete: 'name', label: { en: 'Full name', es: 'Nombre completo' } },
        {
          entry: 'entry.1304183266',
          kind: 'text',
          label: { en: 'Participant ID', es: 'Número de participante' },
          help: { en: 'Staff will add it if you leave it blank.', es: 'El personal lo agregará si lo deja en blanco.' },
        },
        { entry: 'entry.104008577', kind: 'select', required: true, label: { en: 'Cohort', es: 'Grupo (cohorte)' }, choices: COHORTS },
        {
          entry: 'entry.1937477227',
          kind: 'radio',
          required: true,
          label: { en: 'County', es: 'Condado' },
          choices: ['Hunterdon', 'Mercer', 'Middlesex', 'Monmouth', 'Ocean', 'Somerset', 'Union'].map(same),
        },
        { entry: 'entry.2145008359', kind: 'radio', required: true, label: { en: 'WorkFirst NJ benefit', es: 'Beneficio de WorkFirst NJ' }, choices: [same('TANF'), same('SNAP')] },
        { entry: 'entry.848829829', kind: 'text', half: true, label: { en: 'WorkFirst NJ case number', es: 'Número de caso de WorkFirst NJ' } },
        { entry: 'entry.2076425752', kind: 'text', half: true, label: { en: 'Case manager name', es: 'Nombre de su trabajador(a) de caso' } },
        {
          entry: 'entry.1924799731',
          kind: 'radio',
          required: true,
          label: { en: 'Preferred language', es: 'Idioma preferido' },
          choices: [bi('English / Inglés'), bi('Spanish / Español'), bi('Other / Otro')],
        },
        {
          entry: 'entry.1102082198',
          kind: 'radio',
          required: true,
          label: { en: 'Preferred contact method', es: 'Forma preferida para que MMT se comunique con usted' },
          choices: [bi('Phone / Teléfono'), bi('Email / Correo electrónico'), bi('Text / Mensaje de texto')],
        },
        { entry: 'entry.1384494948', kind: 'tel', required: true, half: true, autocomplete: 'tel', label: { en: 'Phone', es: 'Teléfono' } },
        { entry: 'entry.1590196068', kind: 'email', half: true, autocomplete: 'email', label: { en: 'Email', es: 'Correo electrónico' } },
      ],
    },
    {
      title: { en: 'At home', es: 'En casa' },
      fields: [
        { entry: 'entry.829820065', kind: 'radio', required: true, label: { en: 'Do you have a computer or tablet at home?', es: '¿Tiene una computadora o tableta en casa?' }, choices: YES_NO },
        { entry: 'entry.66685863', kind: 'radio', required: true, label: { en: 'Do you have reliable internet at home?', es: '¿Tiene internet confiable en casa?' }, choices: YES_NO },
        { entry: 'entry.8668350', kind: 'radio', required: true, label: { en: 'Do you have transportation needs?', es: '¿Tiene necesidades de transporte?' }, choices: YES_NO },
        { entry: 'entry.1470120309', kind: 'radio', required: true, label: { en: 'Do you have childcare needs?', es: '¿Tiene necesidades de cuidado de niños?' }, choices: YES_NO },
      ],
    },
    {
      title: { en: 'Your goals', es: 'Sus metas' },
      help: {
        en: 'Write your goals in your own words.',
        es: 'Escriba sus metas con sus propias palabras.',
      },
      fields: [
        {
          entry: 'entry.401174236',
          kind: 'textarea',
          required: true,
          label: { en: 'Short-term employment goal', es: 'Meta de empleo a corto plazo' },
          help: { en: 'The job you want to get in the next few months.', es: 'El trabajo que quiere conseguir en los próximos meses.' },
        },
        {
          entry: 'entry.1313047665',
          kind: 'textarea',
          required: true,
          label: { en: 'Long-term employment goal', es: 'Meta de empleo a largo plazo' },
          help: { en: 'The job you want to have in 1 to 2 years.', es: 'El trabajo que quiere tener en 1 a 2 años.' },
        },
        { entry: 'entry.1390254369', kind: 'text', required: true, label: { en: 'Learning goal 1', es: 'Meta de aprendizaje 1' } },
        { entry: 'entry.1106911370', kind: 'text', label: { en: 'Learning goal 2', es: 'Meta de aprendizaje 2' } },
        { entry: 'entry.1335508969', kind: 'text', label: { en: 'Learning goal 3', es: 'Meta de aprendizaje 3' } },
        {
          entry: 'entry.1812726087',
          kind: 'checkbox',
          label: { en: 'Skill areas you want to build', es: 'Áreas de habilidades que quiere desarrollar' },
          choices: [
            bi('Windows 11 and files / Windows 11 y archivos'),
            same('Microsoft Word'),
            bi('Excel and Google Sheets / Excel y Hojas de cálculo de Google'),
            same('OneDrive and Google Drive'),
            bi('Internet and search / Internet y búsquedas'),
            bi('Professional email / Correo electrónico profesional'),
            bi('Video meetings and online forms / Videollamadas y formularios en línea'),
            bi('Money online, banking and EBT / Dinero en línea, banca y EBT'),
            bi('Passwords and online safety / Contraseñas y seguridad en línea'),
            bi('Scams and privacy / Estafas y privacidad'),
            bi('AI at work / Inteligencia artificial (IA) en el trabajo'),
            bi('Resume, cover letter, job search and interviews / Currículum, carta de presentación, búsqueda de empleo y entrevistas'),
          ],
        },
        {
          entry: 'entry.957542179',
          kind: 'checkbox',
          other: true,
          label: { en: 'Support services that may help', es: 'Servicios de apoyo que le pueden ayudar' },
          choices: [
            bi('Transportation / Transporte'),
            bi('Child care / Cuidado de niños'),
            bi('Laptop or hotspot / Computadora portátil o hotspot'),
            bi('Resume help / Ayuda con el currículum'),
            bi('Interview coaching / Práctica para entrevistas'),
            bi('Counseling or community referral / Consejería o referido a la comunidad'),
            bi('Accommodation for a disability / Adaptación por una discapacidad'),
          ],
        },
        {
          entry: 'entry.1467659682',
          kind: 'scale',
          required: true,
          label: { en: 'How sure do you feel about using a computer today?', es: '¿Qué tan seguro(a) se siente hoy al usar una computadora?' },
          choices: ['1', '2', '3', '4', '5'].map(same),
          scaleLabels: [
            { en: 'Not sure', es: 'Poco seguro(a)' },
            { en: 'Very sure', es: 'Muy seguro(a)' },
          ],
        },
        {
          entry: 'entry.1043545198',
          kind: 'radio',
          required: true,
          label: { en: 'Where do you plan to use office hours?', es: '¿Dónde piensa usar las horas de apoyo?' },
          choices: [bi('Campus lab / Laboratorio del campus'), bi('On Teams from home / En Teams desde casa'), bi('Both / Los dos')],
        },
      ],
    },
];

const iepField = (entry: string): Field => {
  const field = IEP_QUESTIONS.flatMap((section) => section.fields).find((f) => f.entry === entry);
  if (!field) throw new Error(`IEP field ${entry} is not in IEP_QUESTIONS`);
  return field;
};

export const IEP_FORM: StaffForm = {
  id: 'iep-intake-form',
  route: '/iep-submit',
  sections: [
    {
      title: { en: 'About you', es: 'Sobre usted' },
      fields: ['entry.379282059', 'entry.1304183266', 'entry.104008577', 'entry.1937477227', 'entry.2145008359', 'entry.848829829', 'entry.2076425752'].map(iepField),
    },
    {
      title: { en: 'Contact', es: 'Contacto' },
      fields: ['entry.1924799731', 'entry.1102082198', 'entry.1384494948', 'entry.1590196068'].map(iepField),
    },
    {
      title: { en: 'At home', es: 'En casa' },
      fields: ['entry.829820065', 'entry.66685863', 'entry.8668350', 'entry.1470120309', 'entry.1043545198'].map(iepField),
    },
    {
      title: { en: 'Your goals', es: 'Sus metas' },
      help: { en: 'Write your goals in your own words.', es: 'Escriba sus metas con sus propias palabras.' },
      fields: ['entry.401174236', 'entry.1313047665', 'entry.1390254369', 'entry.1106911370', 'entry.1335508969'].map(iepField),
    },
    {
      title: { en: 'Skills and supports', es: 'Habilidades y apoyos' },
      fields: ['entry.1812726087', 'entry.957542179', 'entry.1467659682'].map(iepField),
    },
    { title: { en: 'Review and send', es: 'Revisar y enviar' }, fields: [], review: true },
  ],
};

/* ------------------------------------------------------------------ */
/* Laptop loaner agreement (IT Asset Agreement Form v2.0)              */
/* ------------------------------------------------------------------ */

export const POLICY_PDF = '/loaner/IT-Asset-Policy-v2.1.pdf';

export const LOANER_FORM: StaffForm = {
  id: 'loaner-agreement-form',
  route: '/loaner-submit',
  sections: [
    {
      title: { en: 'Who', es: 'Participante' },
      fields: [
        { entry: 'entry.218598507', kind: 'text', required: true, autocomplete: 'name', label: { en: 'Full name', es: 'Nombre completo' } },
        { entry: 'entry.991666087', kind: 'text', half: true, label: { en: 'Participant ID', es: 'Número de participante' } },
        { entry: 'entry.1600795715', kind: 'select', required: true, half: true, label: { en: 'Cohort', es: 'Grupo (cohorte)' }, choices: COHORTS },
        { entry: 'entry.1242110529', kind: 'tel', required: true, half: true, autocomplete: 'tel', label: { en: 'Phone', es: 'Teléfono' } },
        { entry: 'entry.172260136', kind: 'email', half: true, autocomplete: 'email', label: { en: 'Email', es: 'Correo electrónico' } },
      ],
    },
    {
      title: { en: 'Equipment', es: 'Equipos' },
      fields: [
        { entry: 'entry.1843487727', kind: 'text', required: true, half: true, label: { en: 'Laptop asset tag', es: 'Etiqueta de inventario de la computadora' } },
        { entry: 'entry.1109047904', kind: 'text', required: true, half: true, label: { en: 'Laptop serial number', es: 'Número de serie de la computadora' } },
        { entry: 'entry.151926919', kind: 'radio', required: true, label: { en: 'Charger received', es: 'Cargador recibido' }, choices: YES_NO },
        { entry: 'entry.2031520752', kind: 'radio', required: true, label: { en: 'Hotspot issued', es: 'Hotspot entregado' }, choices: YES_NO },
        { entry: 'entry.266658418', kind: 'text', label: { en: 'Hotspot serial number', es: 'Número de serie del hotspot' } },
        {
          entry: 'entry.539715692',
          kind: 'radio',
          required: true,
          label: { en: 'Condition at issue', es: 'Estado al entregar' },
          choices: [bi('New / Nueva'), bi('Good / Buena'), bi('Noted damage / Daño anotado')],
        },
        {
          entry: 'entry.2080556034',
          kind: 'text',
          label: { en: 'Condition notes', es: 'Notas sobre el estado' },
          help: { en: 'Describe any damage.', es: 'Describa cualquier daño.' },
        },
      ],
    },
    {
      title: { en: 'Agreement', es: 'Acuerdo' },
      fields: [
        {
          entry: 'entry.1883769004',
          kind: 'consent',
          required: true,
          label: {
            en: 'I have read the Mercer Med Tech IT Asset Policy v2.1 and I agree to it.',
            es: 'He leído la Política de Equipos de TI v2.1 de Mercer Med Tech y estoy de acuerdo con ella.',
          },
          choices: [bi('I agree / Estoy de acuerdo')],
        },
        {
          entry: 'entry.1669196297',
          kind: 'consent',
          required: true,
          label: {
            en: "I understand that submitting this form is my electronic signature of this agreement, with today's date.",
            es: 'Entiendo que enviar este formulario es mi firma electrónica de este acuerdo, con la fecha de hoy.',
          },
          choices: [bi('I understand / Entiendo')],
        },
      ],
    },
    {
      title: { en: 'Review and sign', es: 'Revisar y firmar' },
      review: true,
      fields: [
        { entry: 'entry.1838727109', kind: 'text', required: true, half: true, label: { en: 'Staff witness name', es: 'Nombre del miembro del personal que es testigo' } },
        { entry: 'entry.195835422', kind: 'date', required: true, half: true, label: { en: 'Date of issue', es: 'Fecha de entrega' } },
      ],
    },
  ],
};

/**
 * Section C of IT Asset Agreement Form v2.0, word for word
 * (Build scripts/onboarding-forms/student-forms/agreement.js), grouped for the
 * collapsible panels above the signature.
 */
export const LOANER_RULES: { title: Bilingual; rules: Bilingual[] }[] = [
  {
    title: { en: 'The loan', es: 'El préstamo' },
    rules: [
      {
        en: 'The laptop is on loan. It belongs to MMT and stays on MMT’s inventory until ownership is decided (rule 7).',
        es: 'La computadora es un préstamo. Pertenece a MMT y sigue en su inventario hasta que se decida la propiedad (regla 7).',
      },
      { en: 'Use it for training, your job search and related personal use.', es: 'Úsela para la capacitación, la búsqueda de empleo y el uso personal relacionado.' },
      { en: 'Keep it charged, and bring it with its charger to every campus class and lab.', es: 'Manténgala cargada y tráigala con su cargador a cada clase y laboratorio en el campus.' },
      {
        en: 'MMT installs Windows and security updates during the loan, and may lock the laptop if it is reported lost or stolen.',
        es: 'MMT instala las actualizaciones de Windows y de seguridad durante el préstamo, y puede bloquear la computadora si se reporta perdida o robada.',
      },
      { en: 'MMT does not monitor your personal activity on the laptop.', es: 'MMT no supervisa su actividad personal en la computadora.' },
    ],
  },
  {
    title: { en: 'Loss, theft or damage: report within 48 hours', es: 'Pérdida, robo o daño: avise dentro de 48 horas' },
    rules: [
      {
        en: 'Report a lost, stolen or damaged device within 48 hours. A theft is documented with a police report or your signed statement. You are not charged for normal wear. Replacement is decided case by case.',
        es: 'Avise dentro de 48 horas si un equipo se pierde, se lo roban o se daña. Un robo se documenta con un informe de la policía o una declaración firmada por usted. No se le cobra el desgaste normal. El reemplazo se decide caso por caso.',
      },
    ],
  },
  {
    title: { en: 'When the laptop becomes yours: two conditions', es: 'Cuándo la computadora pasa a ser suya: dos condiciones' },
    rules: [
      {
        en: 'The laptop becomes yours when both conditions are met: (1) you complete all the training in your IEP, including the ETPL credential course (you do not need to pass the credential exam); and (2) you start a job within 90 days of completing training and are still working at the 90-day check. Your Career Services Advisor verifies your job at 30, 60 and 90 days. You then sign a Laptop Ownership Transfer Form.',
        es: 'La computadora pasa a ser suya cuando se cumplen las dos condiciones: (1) usted termina toda la capacitación de su IEP, incluido el curso de credencial de la lista ETPL (no necesita aprobar el examen de la credencial); y (2) empieza un trabajo dentro de los 90 días después de terminar la capacitación y sigue trabajando en la verificación de los 90 días. Su Asesor(a) de Servicios de Carrera verifica su empleo a los 30, 60 y 90 días. Después, usted firma un Formulario de Transferencia de Propiedad de la Computadora.',
      },
      {
        en: 'If a job ends before the 90-day check, you keep the laptop on loan while you look for work, as long as you start a new job within 30 days. The 90-day count restarts with the new job.',
        es: 'Si un trabajo termina antes de la verificación de los 90 días, usted conserva la computadora en préstamo mientras busca empleo, siempre que empiece un nuevo trabajo dentro de 30 días. Los 90 días vuelven a contar desde el nuevo trabajo.',
      },
    ],
  },
  {
    title: { en: 'Returning the equipment', es: 'Devolución de los equipos' },
    rules: [
      {
        en: 'Return the laptop, charger and accessories if you withdraw or exit the program before completing it, if you do not start a job within 90 days of completing training, or if a job ends and you do not start a new one within 30 days. MMT may also ask for a device back for repair or replacement.',
        es: 'Devuelva la computadora, el cargador y los accesorios si se retira o sale del programa antes de terminarlo, si no empieza un trabajo dentro de los 90 días después de terminar la capacitación, o si un trabajo termina y no empieza otro dentro de 30 días. MMT también puede pedirle un equipo para repararlo o reemplazarlo.',
      },
      {
        en: 'The hotspot is never transferred. Return it when you start a job or when you exit the program, whichever comes first.',
        es: 'El hotspot nunca pasa a ser suyo. Devuélvalo al empezar un trabajo o al salir del programa, lo que ocurra primero.',
      },
    ],
  },
  {
    title: { en: 'Accounts at exit', es: 'Cuentas al salir' },
    rules: [
      {
        en: 'Your MMT Moodle and Microsoft accounts close when you exit the program. Before then, MMT shows you how to save your work to your own personal account.',
        es: 'Sus cuentas de Moodle y de Microsoft de MMT se cierran cuando usted sale del programa. Antes de eso, MMT le muestra cómo guardar su trabajo en su propia cuenta personal.',
      },
    ],
  },
];

export const LOANER_ACK: Bilingual = {
  en: 'I received the items listed above. I read the rules and had the chance to ask questions. I understand that the laptop is on loan and belongs to MMT until both conditions in rule 7 are met, and I agree to report and return items as the rules describe.',
  es: 'Recibí los equipos indicados arriba. Leí las reglas y tuve la oportunidad de hacer preguntas. Entiendo que la computadora es un préstamo y pertenece a MMT hasta que se cumplan las dos condiciones de la regla 7, y acepto avisar y devolver los equipos como indican las reglas.',
};
