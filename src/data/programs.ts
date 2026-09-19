import { L, type Program, type Localized } from './types';
import type { Locale } from '../i18n';

/* ==========================================================================
   EVERY PROGRAM ON THE SITE LIVES IN THIS ONE FILE, IN BOTH LANGUAGES.
   --------------------------------------------------------------------------
   Each piece of wording is written as L('English', 'Espanol'). Both are
   required: if one is missing the build stops.

   HOW TO MAKE THE MOST COMMON CHANGES

   * What a program says about its next class: edit "statusLine".
   * A price: edit "tuition" (a plain number, no dollar sign and no comma).
     If the price is also written out in the pop-up text, edit that line under
     "detail" too, in both languages.
   * An exam fee: edit EXAM_FEE below, or the program's own "examFee".
   * Hours or length: edit "hours" and "length".

   * To stop advertising a program without deleting it:
       status: 'announce-soon'  -> the card stays, with your statusLine, and
                                   the program is never shown as enrolling.
       status: 'coming-soon'    -> a muted "coming soon" card, no pop-up.
       status: 'hidden'         -> disappears from the site, stays in this file.
       status: 'enrolling'      -> back to normal, everywhere.

   * DO NOT change "formOption", and do not translate it. Those words must
     match the Google Form's dropdown exactly, or the form quietly throws the
     submission away. On Spanish pages the reader sees a Spanish label while
     the value sent to Google stays in English.
     "npm run check:form" fails the build if one of them drifts.

   * Order matters: programs appear in the order they are listed here.
     Med programs come first, then Tech.
   ========================================================================== */

const EXAM_FEE = L('$169', '$169');

export const programs: Program[] = [
  /* ===================== MED TRACK ===================== */
  {
    id: 'certified-medical-assistant',
    track: 'med',
    status: 'enrolling',
    name: L('Certified Medical Assistant', 'Asistente Médico Certificado (Certified Medical Assistant)'),
    shortName: L('Medical Assistant', 'Asistente Médico'),
    tableName: L('Certified Medical Assistant (CMA)', 'Asistente Médico Certificado (Certified Medical Assistant)'),
    modalTitle: L('Certified Medical Assistant (CMA)', 'Asistente Médico Certificado (Certified Medical Assistant)'),
    icon: 'fas fa-stethoscope',
    badge: L('480 Hours', '480 horas'),
    badgeIcon: 'fas fa-clock',
    hours: 480,
    length: L('8 to 12 months', '8 a 12 meses'),
    tuition: 5000,
    examFee: EXAM_FEE,
    modalMeta: L('CIP: 51.0801 | 480 Hours (8-12 Months)', 'CIP: 51.0801 | 480 horas (8 a 12 meses)'),
    statusLine: L(
      'The last group started September 14, 2026. Call for the next date.',
      'El último grupo empezó el 14 de septiembre de 2026. Llame para la próxima fecha.'
    ),
    summary: L(
      'You learn the clinical side and the office side: drawing blood, running EKGs, taking vitals, records, and insurance.',
      'Aprende el lado clínico y el lado de oficina: sacar sangre, hacer electrocardiogramas, tomar signos vitales, expedientes y seguros.'
    ),
    credential: {
      name: L('Certified Medical Assistant', 'Asistente Médico Certificado'),
      awardedBy: L('National Healthcareer Association or MedCA', 'National Healthcareer Association o MedCA'),
    },
    formOption: 'Certified Medical Assistant',
    seo: {
      description: L(
        'Certified Medical Assistant training in Lawrenceville, NJ. 480 hours over 8 to 12 months, the clinical work and the paperwork, plus a 100-hour internship.',
        'Asistente Médico Certificado en Lawrenceville, NJ. 480 horas en 8 a 12 meses, lo clínico y lo de oficina, con pasantía de 100 horas. (609) 712-5499.'
      ),
    },
    detail: {
      en: [
        {
          paragraphs: [
            'This program trains you for both sides of a medical office: the clinical work and the paperwork. It includes a 100-hour internship with local healthcare providers, in a doctor’s office, a hospital, or another health care setting.',
          ],
        },
        {
          heading: 'What you learn',
          bullets: [
            'Anatomy, Physiology, and Medical Terminology',
            'Record Keeping, Insurance Processing, and Office Practices',
            'Laboratory Techniques, Phlebotomy, and EKG',
            'Patient Relations, Medical Law, and Ethics',
            'Taking Medical Histories, Recording Vital Signs, and First Aid',
          ],
        },
        {
          heading: 'The exam',
          paragraphs: [
            'You can take the certification exam online with the National Healthcareer Association, or in person with MedCA.',
          ],
        },
        {
          heading: 'What it costs',
          paragraphs: [
            '<strong>$5,000</strong>, plus a $169 exam fee. That includes your books and the $150 administrative fee. The administrative fee is not refundable.',
          ],
        },
        {
          heading: 'Class dates',
          paragraphs: [
            'New groups start regularly. The most recent group began September 14, 2026. Call for the next start date.',
          ],
        },
        {
          heading: 'What people earn',
          paragraphs: [
            'The median wage is about $44,200 a year, or about $21 an hour. Experienced medical assistants earn over $56,000.',
          ],
        },
        {
          heading: 'Where it leads',
          paragraphs: [
            'The Bureau of Labor Statistics expects medical assistant jobs to grow 12% over the next ten years, and counts about 112,300 openings a year. From here, people often move into office management or go on to nursing.',
          ],
        },
      ],
      es: [
        {
          paragraphs: [
            'Este programa le capacita para los dos lados de un consultorio médico: el trabajo clínico y el papeleo. Incluye una pasantía (externship) de 100 horas con proveedores de salud de la zona, en un consultorio, un hospital u otro lugar de atención.',
          ],
        },
        {
          heading: 'Qué aprende',
          bullets: [
            'Anatomía, fisiología y terminología médica',
            'Expedientes, trámites de seguro y prácticas de oficina',
            'Técnicas de laboratorio, flebotomía y electrocardiogramas',
            'Trato con el paciente, ley médica y ética',
            'Historial médico, signos vitales y primeros auxilios',
          ],
        },
        {
          heading: 'El examen',
          paragraphs: [
            'Puede tomar el examen de certificación en línea con la National Healthcareer Association, o en persona con MedCA.',
          ],
        },
        {
          heading: 'Cuánto cuesta',
          paragraphs: [
            '<strong>$5,000</strong>, más $169 del examen. Eso incluye los libros y la cuota administrativa de $150. La cuota administrativa no se devuelve.',
          ],
        },
        {
          heading: 'Fechas de clase',
          paragraphs: [
            'Empezamos grupos nuevos con frecuencia. El grupo más reciente empezó el 14 de septiembre de 2026. Llame para la próxima fecha.',
          ],
        },
        {
          heading: 'Cuánto se gana',
          paragraphs: [
            'El sueldo medio es de unos $44,200 al año, o unos $21 por hora. Los asistentes médicos con experiencia ganan más de $56,000.',
          ],
        },
        {
          heading: 'A dónde lleva',
          paragraphs: [
            'La Oficina de Estadísticas Laborales espera que los empleos de asistente médico crezcan 12% en los próximos diez años, y cuenta unas 112,300 vacantes al año. Desde aquí, muchas personas pasan a la administración de consultorios o siguen hacia enfermería.',
          ],
        },
      ],
    },
  },
  {
    id: 'phlebotomy-technician',
    track: 'med',
    status: 'enrolling',
    name: L('Phlebotomy Technician', 'Técnico en Flebotomía (Phlebotomy Technician)'),
    shortName: L('Phlebotomy', 'Flebotomía'),
    tableName: L('Phlebotomy Technician', 'Técnico en Flebotomía (Phlebotomy Technician)'),
    icon: 'fas fa-syringe',
    badge: L('120 Hours', '120 horas'),
    badgeIcon: 'fas fa-clock',
    hours: 120,
    length: L('~6 weeks', '~6 semanas'),
    tuition: 1500,
    examFee: EXAM_FEE,
    modalMeta: L('CIP: 51.1009 | 120 Hours', 'CIP: 51.1009 | 120 horas'),
    statusLine: L('Call for the next start date', 'Llame para la próxima fecha de inicio'),
    summary: L(
      'Learn to draw blood safely, handle and label samples, and work cleanly in a lab. You practice on real equipment.',
      'Aprenda a sacar sangre con seguridad, a manejar y etiquetar las muestras y a trabajar limpio en un laboratorio. Practica con equipo real.'
    ),
    credential: {
      name: L('Phlebotomy Technician', 'Técnico en Flebotomía'),
      awardedBy: L('National Healthcareer Association or MedCA', 'National Healthcareer Association o MedCA'),
    },
    formOption: 'Phlebotomy Technician',
    seo: {
      description: L(
        'Phlebotomy Technician training in Lawrenceville, NJ. 120 hours over about six weeks, drawing blood safely and handling samples. Call (609) 712-5499.',
        'Técnico en Flebotomía en Lawrenceville, NJ. 120 horas en unas seis semanas, sacar sangre con seguridad y manejar las muestras. (609) 712-5499.'
      ),
    },
    detail: {
      en: [
        { paragraphs: ['This course teaches you to draw blood safely, and to handle what you collect correctly.'] },
        {
          heading: 'What you learn',
          bullets: [
            'Universal Precautions and Infection Control',
            'Capillary Sticks, Skin Puncture, and Venipuncture',
            'Butterfly Techniques and Multiple Tube Drawings',
            'Specimen Handling, Transportation, and Processing',
            'Medical Law, Ethics, and Patient Confidentiality',
          ],
        },
        {
          heading: 'The exam',
          paragraphs: [
            'You can take the certification exam online with the National Healthcareer Association, or in person with MedCA.',
          ],
        },
        { heading: 'What it costs', paragraphs: ['<strong>$1,500</strong>, plus a $169 exam fee.'] },
        {
          heading: 'What people earn',
          paragraphs: ['The median wage is about $43,600 a year, or about $21 an hour.'],
        },
        {
          heading: 'Where it leads',
          paragraphs: [
            'The Bureau of Labor Statistics expects phlebotomy jobs to grow 6% over the next ten years, and counts about 18,400 openings a year. Many phlebotomists go on to train as lab technicians or nurses.',
          ],
        },
      ],
      es: [
        {
          paragraphs: [
            'Este curso le enseña a sacar sangre con seguridad y a manejar correctamente lo que recoge.',
          ],
        },
        {
          heading: 'Qué aprende',
          bullets: [
            'Precauciones universales y control de infecciones',
            'Punción capilar, punción de piel y venopunción',
            'Técnica de mariposa y tomas de varios tubos',
            'Manejo, transporte y procesamiento de muestras',
            'Ley médica, ética y confidencialidad del paciente',
          ],
        },
        {
          heading: 'El examen',
          paragraphs: [
            'Puede tomar el examen de certificación en línea con la National Healthcareer Association, o en persona con MedCA.',
          ],
        },
        { heading: 'Cuánto cuesta', paragraphs: ['<strong>$1,500</strong>, más $169 del examen.'] },
        {
          heading: 'Cuánto se gana',
          paragraphs: ['El sueldo medio es de unos $43,600 al año, o unos $21 por hora.'],
        },
        {
          heading: 'A dónde lleva',
          paragraphs: [
            'La Oficina de Estadísticas Laborales espera que los empleos de flebotomía crezcan 6% en los próximos diez años, y cuenta unas 18,400 vacantes al año. Muchas personas siguen después hacia técnico de laboratorio o enfermería.',
          ],
        },
      ],
    },
  },
  {
    id: 'patient-care-technician',
    track: 'med',
    status: 'enrolling',
    name: L('Patient Care Technician', 'Técnico en Cuidado del Paciente (Patient Care Technician)'),
    shortName: L('Patient Care Technician', 'Cuidado del Paciente'),
    listName: L('Patient Care Technician (PCT)', 'Técnico en Cuidado del Paciente (PCT)'),
    tableName: L('Patient Care Technician (PCT)', 'Técnico en Cuidado del Paciente (Patient Care Technician)'),
    modalTitle: L(
      'Certified Patient Care Technician (PCT)',
      'Técnico Certificado en Cuidado del Paciente (Certified Patient Care Technician)'
    ),
    icon: 'fas fa-user-nurse',
    badge: L('300 Hours', '300 horas'),
    badgeIcon: 'fas fa-clock',
    hours: 300,
    length: L('5 to 6 months', '5 a 6 meses'),
    tuition: 4000,
    examFee: EXAM_FEE,
    modalMeta: L('CIP: 51.0904 | 300 Hours | 5 to 6 Months', 'CIP: 51.0904 | 300 horas | 5 a 6 meses'),
    statusLine: L('Call for the next start date', 'Llame para la próxima fecha de inicio'),
    summary: L(
      'Vitals, EKGs, drawing blood, oxygen, and medications, for work in hospitals, rehab, and long-term care.',
      'Signos vitales, electrocardiogramas, sacar sangre, oxígeno y medicamentos, para trabajar en hospitales, rehabilitación y cuidado a largo plazo.'
    ),
    credential: {
      name: L('Certified Patient Care Technician', 'Técnico Certificado en Cuidado del Paciente'),
    },
    formOption: 'Patient Care Technician (PCT)',
    seo: {
      description: L(
        'Patient Care Technician training in Lawrenceville, NJ. 300 hours over 5 to 6 months: vitals, EKGs, drawing blood, oxygen, and medications.',
        'Técnico en Cuidado del Paciente en Lawrenceville, NJ. 300 horas en 5 a 6 meses: signos vitales, electrocardiogramas, sangre, oxígeno y medicamentos.'
      ),
    },
    detail: {
      en: [
        {
          paragraphs: [
            'Patient Care Technicians work in hospitals, clinics, rehab centers, assisted living, and nursing homes. You work under a nurse or a doctor, caring for patients and keeping their records.',
          ],
        },
        {
          heading: 'What you learn',
          bullets: [
            'Basic Anatomy and Physiology',
            'Phlebotomy and Specimen Collection',
            'EKG Lead Placement and Basic Interpretation',
            'Vital Signs and Patient Observation',
            'Oxygen Administration',
            'Medication Administration and Application',
            'Record-Keeping and Patient Documentation',
          ],
        },
        {
          heading: 'How the program runs',
          paragraphs: [
            'Minimum 300 hours, with hands-on practice and an externship with local healthcare providers. The training is spread over several weeks so you have time to practice.',
          ],
        },
        {
          heading: 'What it costs',
          paragraphs: [
            '<strong>$4,000</strong>, plus a $169 exam fee. We do not give out financial aid ourselves, but we do take outside grants, including One-Stop Career Center and NJ Department of Labor funding.',
          ],
        },
        { heading: 'What you need to start', paragraphs: ['High school diploma or GED.'] },
        {
          heading: 'What people earn',
          paragraphs: [
            'PCTs usually earn between $35,000 and $48,000 a year, or about $17 to $23 an hour. In hospitals, experienced PCTs earn over $52,000. These figures start from the Bureau of Labor Statistics nursing assistant median of $38,200 and account for the wider PCT role.',
          ],
        },
        {
          heading: 'Where it leads',
          paragraphs: [
            'The Bureau of Labor Statistics expects these jobs to grow 4% over the next ten years. Many PCTs go on to train as practical nurses or registered nurses.',
          ],
        },
        {
          heading: 'Support while you train',
          paragraphs: [
            'You can talk through your options with us, we help you look for work, and we have staff who speak Spanish.',
          ],
        },
      ],
      es: [
        {
          paragraphs: [
            'Los técnicos en cuidado del paciente trabajan en hospitales, clínicas, centros de rehabilitación, residencias asistidas y hogares de ancianos. Usted trabaja bajo una enfermera o un doctor, cuidando pacientes y llevando sus expedientes.',
          ],
        },
        {
          heading: 'Qué aprende',
          bullets: [
            'Anatomía y fisiología básicas',
            'Flebotomía y toma de muestras',
            'Colocación de electrodos e interpretación básica del electrocardiograma',
            'Signos vitales y observación del paciente',
            'Administración de oxígeno',
            'Administración y aplicación de medicamentos',
            'Expedientes y documentación del paciente',
          ],
        },
        {
          heading: 'Cómo funciona el programa',
          paragraphs: [
            'Mínimo 300 horas, con mucha práctica y una pasantía (externship) con proveedores de salud de la zona. La capacitación se reparte en varias semanas para que tenga tiempo de practicar.',
          ],
        },
        {
          heading: 'Cuánto cuesta',
          paragraphs: [
            '<strong>$4,000</strong>, más $169 del examen. Nosotros no damos ayuda económica propia, pero sí aceptamos subvenciones de afuera, incluidas las del One-Stop Career Center y del Departamento de Trabajo de Nueva Jersey.',
          ],
        },
        {
          heading: 'Qué necesita para empezar',
          paragraphs: ['Diploma de escuela secundaria (high school) o GED.'],
        },
        {
          heading: 'Cuánto se gana',
          paragraphs: [
            'Estos técnicos suelen ganar entre $35,000 y $48,000 al año, o unos $17 a $23 por hora. En hospitales, los que tienen experiencia ganan más de $52,000. Estas cifras parten del sueldo medio de asistente de enfermería de la Oficina de Estadísticas Laborales, $38,200, ajustado por el trabajo más amplio del técnico en cuidado del paciente.',
          ],
        },
        {
          heading: 'A dónde lleva',
          paragraphs: [
            'La Oficina de Estadísticas Laborales espera que estos empleos crezcan 4% en los próximos diez años. Muchos siguen después hacia enfermería práctica o enfermería registrada.',
          ],
        },
        {
          heading: 'Apoyo mientras se capacita',
          paragraphs: [
            'Puede hablar sus opciones con nosotros, le ayudamos a buscar trabajo, y tenemos personal que habla español.',
          ],
        },
      ],
    },
  },
  {
    id: 'ekg-technician',
    track: 'med',
    status: 'enrolling',
    name: L('EKG Technician', 'Técnico en Electrocardiogramas (EKG Technician)'),
    shortName: L('EKG', 'EKG'),
    tableName: L('EKG Technician', 'Técnico en Electrocardiogramas (EKG Technician)'),
    icon: 'fas fa-heartbeat',
    badge: L('120 Hours', '120 horas'),
    badgeIcon: 'fas fa-clock',
    hours: 120,
    length: L('6 weeks', '6 semanas'),
    tuition: 1400,
    examFee: EXAM_FEE,
    modalMeta: L('CIP: 51.0902 | 120 Hours (6 Weeks)', 'CIP: 51.0902 | 120 horas (6 semanas)'),
    statusLine: L('Call for availability', 'Llame para ver la disponibilidad'),
    summary: L(
      'Learn how the heart works, how to run an EKG machine, and how to read the printout.',
      'Aprenda cómo funciona el corazón, cómo usar la máquina de electrocardiogramas y cómo leer lo que imprime.'
    ),
    credential: {
      name: L('EKG Technician', 'Técnico en Electrocardiogramas'),
      awardedBy: L('National Healthcareer Association or MedCA', 'National Healthcareer Association o MedCA'),
    },
    formOption: 'EKG Technician',
    seo: {
      description: L(
        'EKG Technician training in Lawrenceville, NJ. 120 hours over six weeks, running an EKG machine and reading the printout, with a 100-hour internship.',
        'Técnico en Electrocardiogramas en Lawrenceville, NJ. 120 horas en seis semanas, usar la máquina y leer lo que imprime, con pasantía de 100 horas.'
      ),
    },
    detail: {
      en: [
        {
          paragraphs: [
            'In six weeks you learn to run an EKG machine and read what it prints. The program includes a 100-hour internship with local healthcare providers.',
          ],
        },
        {
          heading: 'What you learn',
          bullets: [
            'Cardiovascular Anatomy and Physiology',
            'EKG Machine Operation and Graph Interpretation',
            '12-Lead EKG Placement and Artifact Recognition',
            'Pharmacology of Cardiac Diseases',
            'Patient Education and Safety',
          ],
        },
        {
          heading: 'The exam',
          paragraphs: [
            'You can take the certification exam online with the National Healthcareer Association, or in person with MedCA.',
          ],
        },
        { heading: 'What it costs', paragraphs: ['<strong>$1,400</strong>, plus a $169 exam fee.'] },
        {
          heading: 'What people earn',
          paragraphs: [
            'Most earn between $42,000 and $54,000 a year, or about $20 to $26 an hour, depending on where they work.',
          ],
        },
        {
          heading: 'Where it leads',
          paragraphs: [
            'The Bureau of Labor Statistics expects these jobs to grow 3% over the next ten years. From here you can train further as a cardiovascular technologist or a telemetry technician.',
          ],
        },
      ],
      es: [
        {
          paragraphs: [
            'En seis semanas aprende a usar la máquina de electrocardiogramas y a leer lo que imprime. El programa incluye una pasantía (externship) de 100 horas con proveedores de salud de la zona.',
          ],
        },
        {
          heading: 'Qué aprende',
          bullets: [
            'Anatomía y fisiología cardiovascular',
            'Uso de la máquina e interpretación de la gráfica',
            'Colocación de 12 derivaciones y reconocimiento de interferencias',
            'Farmacología de las enfermedades del corazón',
            'Educación y seguridad del paciente',
          ],
        },
        {
          heading: 'El examen',
          paragraphs: [
            'Puede tomar el examen de certificación en línea con la National Healthcareer Association, o en persona con MedCA.',
          ],
        },
        { heading: 'Cuánto cuesta', paragraphs: ['<strong>$1,400</strong>, más $169 del examen.'] },
        {
          heading: 'Cuánto se gana',
          paragraphs: [
            'La mayoría gana entre $42,000 y $54,000 al año, o unos $20 a $26 por hora, según dónde trabaje.',
          ],
        },
        {
          heading: 'A dónde lleva',
          paragraphs: [
            'La Oficina de Estadísticas Laborales espera que estos empleos crezcan 3% en los próximos diez años. Desde aquí puede seguir hacia tecnólogo cardiovascular o técnico en telemetría.',
          ],
        },
      ],
    },
  },
  {
    id: 'certified-nursing-assistant',
    track: 'med',
    status: 'announce-soon',
    name: L('Certified Nursing Assistant', 'Asistente de Enfermería Certificado (Certified Nursing Assistant)'),
    shortName: L('Certified Nursing Assistant', 'Asistente de Enfermería'),
    tableName: L(
      'Certified Nursing Assistant (CNA)',
      'Asistente de Enfermería Certificado (Certified Nursing Assistant)'
    ),
    modalTitle: L(
      'Certified Nursing Assistant (CNA)',
      'Asistente de Enfermería Certificado (Certified Nursing Assistant)'
    ),
    icon: 'fas fa-user-nurse',
    badge: L('90 Hours', '90 horas'),
    badgeIcon: 'fas fa-clock',
    hours: 90,
    length: L('~6 weeks', '~6 semanas'),
    tuition: 2000,
    examFee: EXAM_FEE,
    modalMeta: L('CIP: 51.3902 | 90 Hours', 'CIP: 51.3902 | 90 horas'),
    statusLine: L('Next sessions will be announced soon.', 'Las próximas sesiones se anunciarán pronto.'),
    modalCta: L('Ask us about CNA', 'Pregúntenos por CNA'),
    summary: L(
      'Basic nursing and patient care skills, for work in nursing homes, hospitals, clinics, and home care.',
      'Lo básico de enfermería y cuidado del paciente, para trabajar en hogares de ancianos, hospitales, clínicas y cuidado en casa.'
    ),
    credential: {
      name: L('Certified Nursing Assistant', 'Asistente de Enfermería Certificado'),
      awardedBy: L(
        'New Jersey state skills exam and a PSI written exam',
        'Examen práctico del estado de Nueva Jersey y examen escrito en PSI'
      ),
    },
    formOption: 'Certified Nursing Assistant (CNA)',
    seo: {
      description: L(
        'Certified Nursing Assistant training in Lawrenceville, NJ. 90 hours of nursing and patient care skills, with supervised clinical experience.',
        'Asistente de Enfermería Certificado en Lawrenceville, NJ. 90 horas de enfermería y cuidado del paciente, con práctica clínica supervisada.'
      ),
    },
    detail: {
      en: [
        {
          paragraphs: [
            'This program teaches the basic skills a nursing assistant needs, for work in nursing homes, hospitals, clinics, and home care.',
          ],
        },
        {
          heading: 'How the program runs',
          bullets: ['50 hours of lecture and lab work.', '40 hours of supervised clinical experience.'],
        },
        {
          heading: 'The exam',
          paragraphs: [
            'When you finish, you take the state skills exam here at the school, and the written exam at a PSI testing center nearby.',
          ],
        },
        { heading: 'What it costs', paragraphs: ['<strong>$2,000</strong>, plus a $169 exam fee.'] },
        {
          heading: 'What people earn',
          paragraphs: ['The median wage is about $39,400 a year, or about $19 an hour.'],
        },
        {
          heading: 'Where it leads',
          paragraphs: [
            'Growth is slow, about 2% over ten years, but the Bureau of Labor Statistics still counts about 211,800 openings a year, because people move on. It is a common way into health care, and many CNAs go on to nursing.',
          ],
        },
        { heading: 'Please note', paragraphs: ['We need at least 20 students to run a group.'] },
      ],
      es: [
        {
          paragraphs: [
            'Este programa enseña lo básico que necesita un asistente de enfermería, para trabajar en hogares de ancianos, hospitales, clínicas y cuidado en casa.',
          ],
        },
        {
          heading: 'Cómo funciona el programa',
          bullets: [
            '50 horas de clase y laboratorio.',
            '40 horas de práctica clínica supervisada.',
          ],
        },
        {
          heading: 'El examen',
          paragraphs: [
            'Al terminar, toma el examen práctico del estado aquí en la escuela y el examen escrito en un centro PSI cercano.',
          ],
        },
        { heading: 'Cuánto cuesta', paragraphs: ['<strong>$2,000</strong>, más $169 del examen.'] },
        {
          heading: 'Cuánto se gana',
          paragraphs: ['El sueldo medio es de unos $39,400 al año, o unos $19 por hora.'],
        },
        {
          heading: 'A dónde lleva',
          paragraphs: [
            'El crecimiento es lento, como 2% en diez años, pero la Oficina de Estadísticas Laborales cuenta unas 211,800 vacantes al año, porque la gente va cambiando de puesto. Es una entrada común al campo de la salud, y muchos siguen después hacia enfermería.',
          ],
        },
        {
          heading: 'Tenga en cuenta',
          paragraphs: ['Necesitamos al menos 20 estudiantes para abrir un grupo.'],
        },
      ],
    },
  },
  {
    id: 'certified-medication-aide',
    track: 'med',
    status: 'announce-soon',
    name: L('Certified Medication Aide', 'Asistente Certificado de Medicamentos (Certified Medication Aide)'),
    shortName: L('Certified Medication Aide', 'Asistente de Medicamentos'),
    tableName: L(
      'Certified Medication Aide',
      'Asistente Certificado de Medicamentos (Certified Medication Aide)'
    ),
    icon: 'fas fa-pills',
    badge: L('30 Hours', '30 horas'),
    badgeIcon: 'fas fa-clock',
    hours: 30,
    length: L('~1 week', '~1 semana'),
    tuition: 900,
    examFee: EXAM_FEE,
    modalMeta: L('CIP: 51.2603 | 30 Hours', 'CIP: 51.2603 | 30 horas'),
    statusLine: L('Next sessions will be announced soon.', 'Las próximas sesiones se anunciarán pronto.'),
    modalCta: L('Ask us about Medication Aide', 'Pregúntenos por Asistente de Medicamentos'),
    summary: L(
      'A short certification for working CNAs, so you can give residents their medications in assisted living.',
      'Una certificación corta para asistentes de enfermería que ya trabajan, para poder dar los medicamentos a los residentes en residencias asistidas.'
    ),
    credential: {
      name: L('Certified Medication Aide', 'Asistente Certificado de Medicamentos'),
      awardedBy: L(
        'New Jersey Department of Health and Senior Services',
        'New Jersey Department of Health and Senior Services'
      ),
    },
    formOption: 'Certified Medication Aide',
    seo: {
      description: L(
        'Certified Medication Aide training in Lawrenceville, NJ. A 30 hour certification for working CNAs in assisted living.',
        'Asistente Certificado de Medicamentos en Lawrenceville, NJ. 30 horas para asistentes de enfermería que ya trabajan en residencias asistidas.'
      ),
    },
    detail: {
      en: [
        {
          paragraphs: [
            'If you are already a certified nursing assistant, this certifies you to give residents their medications. The certificate comes from the New Jersey Department of Health and Senior Services, and it lets you work in assisted-living residences, comprehensive personal care homes, and assisted living programs.',
          ],
        },
        {
          heading: 'Why add it',
          paragraphs: [
            'It is a short step up from CNA. You can do more on shift, and more places will hire you, especially assisted living.',
          ],
        },
        {
          heading: 'What you learn',
          bullets: [
            'Safe Medication Administration in Assisted-Living Settings',
            'Pharmacology Fundamentals for Common Medications',
            'Documentation and Reporting',
            'Identifying Adverse Reactions and When to Escalate',
            'Resident Rights and Confidentiality',
          ],
        },
        { heading: 'What it costs', paragraphs: ['<strong>$900</strong>, plus a $169 exam fee.'] },
        { heading: 'What you need to start', paragraphs: ['Active CNA certification.'] },
        {
          heading: 'What people earn',
          paragraphs: [
            'Most earn between $36,000 and $45,000 a year, or about $17 to $22 an hour. Adding this to a CNA certificate usually lifts pay 5% to 15% above nursing assistant wages, starting from the Bureau of Labor Statistics median of $38,200.',
          ],
        },
        {
          heading: 'Where it leads',
          paragraphs: [
            'Medication aides often work in assisted-living facilities. They also work in comprehensive personal care homes and assisted living programs, and the certificate is a step toward nursing or pharmacy technician training.',
          ],
        },
      ],
      es: [
        {
          paragraphs: [
            'Si usted ya tiene la certificación de asistente de enfermería (CNA), esto le certifica para dar los medicamentos a los residentes. El certificado lo da el New Jersey Department of Health and Senior Services, y le permite trabajar en residencias asistidas, comprehensive personal care homes (hogares de cuidado personal) y programas de vida asistida.',
          ],
        },
        {
          heading: 'Por qué agregarlo',
          paragraphs: [
            'Es un paso corto después de CNA. Puede hacer más en su turno, y hay más lugares donde puede trabajar, sobre todo en residencias asistidas.',
          ],
        },
        {
          heading: 'Qué aprende',
          bullets: [
            'Administración segura de medicamentos en residencias asistidas',
            'Fundamentos de farmacología de los medicamentos comunes',
            'Documentación y reportes',
            'Cómo reconocer reacciones adversas y cuándo avisar',
            'Derechos del residente y confidencialidad',
          ],
        },
        { heading: 'Cuánto cuesta', paragraphs: ['<strong>$900</strong>, más $169 del examen.'] },
        {
          heading: 'Qué necesita para empezar',
          paragraphs: ['Certificación de CNA vigente.'],
        },
        {
          heading: 'Cuánto se gana',
          paragraphs: [
            'La mayoría gana entre $36,000 y $45,000 al año, o unos $17 a $22 por hora. Agregar esto al certificado de CNA suele subir el pago entre 5% y 15% sobre el sueldo de asistente de enfermería, partiendo del sueldo medio de $38,200 de la Oficina de Estadísticas Laborales.',
          ],
        },
        {
          heading: 'A dónde lleva',
          paragraphs: [
            'Los asistentes de medicamentos trabajan con frecuencia en residencias asistidas. También trabajan en comprehensive personal care homes y en programas de vida asistida, y el certificado es un paso hacia enfermería o hacia técnico de farmacia.',
          ],
        },
      ],
    },
  },
  {
    id: 'dental-assistant',
    track: 'med',
    status: 'coming-soon',
    name: L('Dental Assistant', 'Asistente Dental (Dental Assistant)'),
    shortName: L('Dental Assistant', 'Asistente Dental'),
    icon: 'fas fa-tooth',
    badge: L('Coming Soon', 'Próximamente'),
    badgeIcon: 'fas fa-hourglass-half',
    tuition: null,
    cta: L('Put me on the list', 'Anóteme en la lista'),
    summary: L(
      'Chairside assisting, sterilizing instruments, and running a dental office. Not open yet. Put your name down and we will tell you when it starts.',
      'Asistencia al lado del sillón, esterilización de instrumentos y el manejo de un consultorio dental. Todavía no abre. Déjenos su nombre y le avisamos cuándo empieza.'
    ),
    formOption: 'Not sure yet',
    detail: { en: [], es: [] },
  },
  {
    id: 'medical-billing-and-coding',
    track: 'med',
    status: 'coming-soon',
    name: L('Medical Billing & Coding', 'Facturación y Codificación Médica (Medical Billing & Coding)'),
    shortName: L('Medical Billing & Coding', 'Facturación y Codificación'),
    icon: 'fas fa-file-invoice-dollar',
    badge: L('Coming Soon', 'Próximamente'),
    badgeIcon: 'fas fa-hourglass-half',
    tuition: null,
    cta: L('Put me on the list', 'Anóteme en la lista'),
    summary: L(
      'Insurance claims, medical coding, and running a medical office. Not open yet. Put your name down and we will tell you when it starts.',
      'Reclamos de seguro, codificación médica y el manejo de un consultorio. Todavía no abre. Déjenos su nombre y le avisamos cuándo empieza.'
    ),
    formOption: 'Not sure yet',
    detail: { en: [], es: [] },
  },

  /* ===================== TECH TRACK ===================== */
  {
    id: 'digital-literacy-training',
    track: 'tech',
    status: 'enrolling',
    /**
     * "Alfabetizacion" is the word Latin American Spanish uses for teaching
     * adults to read and write, so it collides with the respect-first rule.
     * The reader-facing Spanish name is "Capacitacion en Habilidades
     * Digitales", with the official English name in brackets on first use.
     */
    name: L('Digital Literacy Training', 'Capacitación en Habilidades Digitales (Digital Literacy Training)'),
    shortName: L('Digital Literacy Training', 'Habilidades Digitales'),
    tableName: L(
      'Digital Literacy Training',
      'Capacitación en Habilidades Digitales (Digital Literacy Training)'
    ),
    icon: 'fas fa-laptop',
    badge: L('No cost if you qualify', 'Sin costo si califica'),
    badgeIcon: 'fas fa-tag',
    hours: L('Varies by plan', 'Según su plan'),
    length: L('About 5 to 6 weeks', 'Unas 5 a 6 semanas'),
    tuition: null,
    tuitionLabel: L('No cost', 'Sin costo'),
    tuitionNote: L('if you qualify', 'si califica'),
    examFee: L('Included', 'Incluido'),
    statusLine: L('Enrolling soon.', 'Inscripciones próximamente.'),
    summary: L(
      'A short skills check puts you at the right level. From there you cover computer and internet basics, Microsoft Office and Google Workspace, online safety, AI, money management, and getting ready for work. If you qualify it costs you nothing, and you work toward an industry-recognized credential, including an AI literacy micro-credential.',
      'Una revisión corta de lo que ya sabe le coloca en el nivel que le corresponde. De ahí cubre lo básico de la computadora y de internet, Microsoft Office y Google Workspace, seguridad en línea, inteligencia artificial, manejo del dinero y preparación para el trabajo. Si califica no le cuesta nada, y trabaja hacia un certificado reconocido por la industria, incluido un microcertificado en inteligencia artificial.'
    ),
    credential: {
      name: L(
        'Industry-recognized credential, including an AI literacy micro-credential',
        'Certificado reconocido por la industria, incluido un microcertificado en inteligencia artificial'
      ),
    },
    formOption: 'Digital Literacy Training',
    href: '/digital-literacy/',
    detail: { en: [], es: [] },
  },

  /* Parked. Kept here so nothing is lost, rendered nowhere. */
  {
    id: 'cybersecurity-bootcamp',
    track: 'tech',
    status: 'hidden',
    name: L('Cybersecurity Bootcamp', 'Curso Intensivo de Ciberseguridad (Cybersecurity Bootcamp)'),
    shortName: L('Cybersecurity Bootcamp', 'Ciberseguridad'),
    icon: 'fas fa-shield-alt',
    tuition: null,
    summary: L('Not offered on the site at this time.', 'No se ofrece en el sitio por ahora.'),
    formOption: 'Not sure yet',
    detail: { en: [], es: [] },
  },
];

/* ==========================================================================
   Helpers. These are what the pages use, so the rules live in one place.
   ========================================================================== */

/** Everything that should be rendered at all (anything except "hidden"). */
export const visiblePrograms = programs.filter((p) => p.status !== 'hidden');

export const medPrograms = visiblePrograms.filter((p) => p.track === 'med');
export const techPrograms = visiblePrograms.filter((p) => p.track === 'tech');

/** Programs that may be described as enrolling: chips, pills, course offers. */
export const enrollingPrograms = visiblePrograms.filter((p) => p.status === 'enrolling');

/** Med programs that appear in the "when the next groups start" list. */
export const scheduledMedPrograms = medPrograms.filter((p) => p.status !== 'coming-soon');

/** Programs with a pop-up and a /programs/<id>/ page of their own. */
export const detailPrograms = visiblePrograms.filter(
  (p) => (p.status === 'enrolling' || p.status === 'announce-soon') && !p.href && p.detail.en.length > 0
);

/** Rows of the cost table: Med first, then Tech. Coming-soon programs have no price. */
export const tuitionPrograms = [
  ...medPrograms.filter((p) => p.status !== 'coming-soon'),
  ...techPrograms.filter((p) => p.status !== 'coming-soon'),
];

/** Every option the contact form offers, in Med-then-Tech order. */
export const formPrograms = tuitionPrograms;

/** The Google Form dropdown accepts exactly these strings and nothing else. */
export const FORM_OPTION_ALLOW_LIST = [
  'Certified Medical Assistant',
  'Phlebotomy Technician',
  'Patient Care Technician (PCT)',
  'EKG Technician',
  'Certified Nursing Assistant (CNA)',
  'Certified Medication Aide',
  'Digital Literacy Training',
  'Not sure yet',
] as const;

/** The value the Google Form expects for "I am not sure yet". Never translated. */
export const NOT_SURE_OPTION = 'Not sure yet';

/** Best-time-to-call values. The labels are translated, these are not. */
export const BEST_TIME_VALUES = [
  'Morning (9:00 AM - 12:00 PM)',
  'Afternoon (12:00 PM - 5:00 PM)',
  'Evening (5:00 PM - 8:00 PM)',
  'Anytime',
] as const;

export function programById(id: string): Program | undefined {
  return programs.find((p) => p.id === id);
}

/** "$5,000", or the "no cost" wording for grant-funded programs. */
export function tuitionDisplay(program: Program, locale: Locale): string {
  if (program.tuition === null) return program.tuitionLabel ? program.tuitionLabel[locale] : '';
  return `$${program.tuition.toLocaleString('en-US')}`;
}

/** Hours as text, whether they are a number or wording such as "Varies by plan". */
export function hoursDisplay(program: Program, locale: Locale): string | undefined {
  if (program.hours === undefined) return undefined;
  return typeof program.hours === 'number' ? String(program.hours) : program.hours[locale];
}

/** ISO 8601 duration for structured data, when hours are a plain number. */
export function timeRequired(program: Program): string | undefined {
  return typeof program.hours === 'number' ? `PT${program.hours}H` : undefined;
}

export type { Localized };
