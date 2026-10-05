/**
 * Wording of the two Day 0 acknowledgments, English and Spanish, parsed from
 * DLT Curriculum v1.0/Source markdown/documents/orientation-acknowledgment.md
 * (Part A, Part B) and attendance-and-makeup-policy.md (English, Español).
 * The school's Apps Script holds the same text (ONBOARDING_TEXT) for the PDFs.
 * Edit the markdown first, then both copies.
 */
import type { Bilingual } from './staffForms';

export interface PolicySection {
  title: Bilingual;
  numbered: boolean;
  paras: Bilingual[];
  items: Bilingual[];
}

export const ONBOARDING_TEXT: {
  reviewed: Bilingual[];
  reviewedHelp: Bilingual;
  documents: Bilingual[];
  rights: PolicySection;
  responsibilities: PolicySection;
  concern: PolicySection;
  statement: Bilingual;
  attendance: PolicySection[];
  attendanceStatement: Bilingual;
} = {
  "reviewed": [
    {
      "en": "Program requirements and the 7-week schedule",
      "es": "Los requisitos del programa y el horario de 7 semanas"
    },
    {
      "en": "The 20-hour week, how hours are counted, and that MMT reports my hours to my county every week",
      "es": "La semana de 20 horas, cómo se cuentan las horas, y que MMT envía mis horas a mi condado cada semana"
    },
    {
      "en": "Recorded lessons, office hours and the required weekly check-in",
      "es": "Las lecciones grabadas, las horas de apoyo y la reunión de seguimiento semanal obligatoria"
    },
    {
      "en": "The Attendance and Make-up Policy",
      "es": "La Política de Asistencia y Recuperación"
    },
    {
      "en": "The laptop and hotspot rules, and the two conditions for the laptop to become mine: finish the training in my IEP; start a job within 90 days and still be working at the 90-day check",
      "es": "Las reglas de la computadora portátil y del hotspot, y las dos condiciones para que la computadora pase a ser mía: terminar la capacitación de mi IEP; empezar un trabajo dentro de los 90 días y seguir trabajando en la confirmación de los 90 días"
    },
    {
      "en": "Supportive services and how to ask for them",
      "es": "Los servicios de apoyo y cómo pedirlos"
    },
    {
      "en": "My privacy and the practice identity card",
      "es": "Mi privacidad y la tarjeta de identidad de práctica"
    },
    {
      "en": "My rights (section 3)",
      "es": "Mis derechos (sección 3)"
    },
    {
      "en": "My responsibilities (section 4)",
      "es": "Mis responsabilidades (sección 4)"
    },
    {
      "en": "How to raise a concern (section 5)",
      "es": "Cómo presentar una inquietud (sección 5)"
    }
  ],
  "reviewedHelp": {
    "en": "Put your initials on each line after staff explain it and answer your questions.",
    "es": "Ponga sus iniciales en cada línea después de que el personal se la explique y conteste sus preguntas."
  },
  "documents": [
    {
      "en": "Learner Handbook",
      "es": "Manual del participante"
    },
    {
      "en": "Attendance and Make-up Policy (signed copy)",
      "es": "Política de Asistencia y Recuperación (copia firmada)"
    },
    {
      "en": "Privacy notice",
      "es": "Aviso de privacidad"
    },
    {
      "en": "Approved apps list",
      "es": "Lista de aplicaciones aprobadas"
    },
    {
      "en": "Welcome kit (cohort calendar and class links)",
      "es": "Kit de bienvenida (calendario del grupo y enlaces de clase)"
    },
    {
      "en": "IT Asset Policy summary (in the handbook)",
      "es": "Resumen de la Política de Equipos de TI (en el manual)"
    }
  ],
  "rights": {
    "title": {
      "en": "3. Your rights",
      "es": "3. Sus derechos"
    },
    "numbered": false,
    "paras": [],
    "items": [
      {
        "en": "Equal opportunity. MMT does not discriminate on the basis of race, color, religion, sex, national origin, age, disability, political affiliation or belief, or, for beneficiaries, citizenship status as a lawfully admitted immigrant authorized to work in the United States. This follows Section 188 of the Workforce Innovation and Opportunity Act and 29 CFR Part 38, Title VI of the Civil Rights Act, Section 504 of the Rehabilitation Act, the Age Discrimination Act, Title IX and the Americans with Disabilities Act (ADA).",
        "es": "Igualdad de oportunidades. MMT no discrimina por motivos de raza, color, religión, sexo, origen nacional, edad, discapacidad, afiliación o creencia política, ni, en el caso de los beneficiarios, por su condición de ciudadanía como inmigrante admitido legalmente y autorizado para trabajar en los Estados Unidos. Esto sigue la Sección 188 de la Ley de Innovación y Oportunidades para la Fuerza Laboral (Workforce Innovation and Opportunity Act, WIOA) y el 29 CFR Parte 38, el Título VI de la Ley de Derechos Civiles, la Sección 504 de la Ley de Rehabilitación, la Ley contra la Discriminación por Edad (Age Discrimination Act), el Título IX y la Ley para Estadounidenses con Discapacidades (ADA)."
      },
      {
        "en": "Reasonable accommodation. If you have a disability, you can ask for a reasonable accommodation. Ask the Program Director.",
        "es": "Adaptación razonable. Si usted tiene una discapacidad, puede pedir una adaptación razonable. Pídala al Director(a) del Programa."
      },
      {
        "en": "Your language. You can get services and documents in English or Spanish, and help reading any document.",
        "es": "Su idioma. Usted puede recibir los servicios y los documentos en inglés o en español, y ayuda para leer cualquier documento."
      },
      {
        "en": "Privacy. Your records are kept private. You have the right to see your own file.",
        "es": "Privacidad. Sus registros se mantienen en privado. Usted tiene derecho a ver su propio archivo."
      },
      {
        "en": "Concerns. You can raise a concern or a complaint without retaliation.",
        "es": "Inquietudes. Usted puede presentar una inquietud o una queja sin represalias."
      },
      {
        "en": "Leaving. You can leave the program at any time. Tell your Career Services Advisor and your county caseworker first, and return MMT equipment.",
        "es": "Salir del programa. Usted puede dejar el programa en cualquier momento. Primero avísele a su Asesor(a) de Servicios de Carrera y a su trabajador(a) de caso del condado, y devuelva los equipos de MMT."
      }
    ]
  },
  "responsibilities": {
    "title": {
      "en": "4. Your responsibilities",
      "es": "4. Sus responsabilidades"
    },
    "numbered": false,
    "paras": [],
    "items": [
      {
        "en": "Take part 20 hours a week, and meet with staff for a check-in every week.",
        "es": "Participar 20 horas a la semana y reunirse con el personal para una reunión de seguimiento cada semana."
      },
      {
        "en": "Tell MMT ahead of time if you will miss your check-in or fall behind.",
        "es": "Avisarle a MMT con anticipación si va a faltar a su reunión de seguimiento o si se va a atrasar."
      },
      {
        "en": "Do your own work in every task.",
        "es": "Hacer su propio trabajo en cada tarea."
      },
      {
        "en": "Keep the laptop and hotspot safe and charged. Bring the laptop to office hours on campus. Report loss or damage within 48 hours.",
        "es": "Mantener la computadora portátil y el hotspot seguros y cargados. Traer la computadora a las horas de apoyo en el campus. Avisar dentro de 48 horas si se pierden o se dañan."
      },
      {
        "en": "Be respectful of staff and classmates.",
        "es": "Tratar con respeto al personal y a sus compañeros."
      },
      {
        "en": "Keep your contact information current with MMT and with your county caseworker.",
        "es": "Mantener al día sus datos de contacto con MMT y con su trabajador(a) de caso del condado."
      },
      {
        "en": "Tell your county caseworker about changes in your benefits, address or work.",
        "es": "Avisarle a su trabajador(a) de caso del condado de cambios en sus beneficios, su dirección o su trabajo."
      },
      {
        "en": "Never share your Moodle or Microsoft password.",
        "es": "Nunca compartir su contraseña de Moodle o de Microsoft."
      }
    ]
  },
  "concern": {
    "title": {
      "en": "5. How to raise a concern",
      "es": "5. Cómo presentar una inquietud"
    },
    "numbered": false,
    "paras": [
      {
        "en": "No one may retaliate against you for raising a concern.",
        "es": "Nadie puede tomar represalias contra usted por presentar una inquietud."
      }
    ],
    "items": [
      {
        "en": "Step 1. Talk to your Career Services Advisor.",
        "es": "Paso 1. Hable con su Asesor(a) de Servicios de Carrera."
      },
      {
        "en": "Step 2. Write to the Program Director at contact@mercermedtech.com, or hand a note to any staff member. You receive a written answer within 10 business days.",
        "es": "Paso 2. Escriba al Director(a) del Programa a contact@mercermedtech.com, o entregue una nota a cualquier persona del personal. Usted recibe una respuesta por escrito dentro de 10 días hábiles."
      },
      {
        "en": "Step 3. You may also contact the New Jersey Department of Labor and Workforce Development, which funds this program. MMT gives you its contact information in writing if you ask.",
        "es": "Paso 3. También puede comunicarse con el Departamento de Trabajo y Desarrollo de la Fuerza Laboral de New Jersey, que financia este programa. Si lo pide, MMT le da sus datos de contacto por escrito."
      }
    ]
  },
  "statement": {
    "en": "I attended orientation. The items above were explained to me in the language I chose, I had the chance to ask questions, and I received copies of the documents checked above.",
    "es": "Asistí a la orientación. Me explicaron los puntos anteriores en el idioma que elegí, tuve la oportunidad de hacer preguntas y recibí copias de los documentos marcados arriba."
  },
  "attendance": [
    {
      "title": {
        "en": "Why this policy matters",
        "es": "Por qué importa esta política"
      },
      "numbered": false,
      "paras": [
        {
          "en": "Every week of this program is 20 hours. Your county counts these hours for WorkFirst NJ. Each lesson also builds on the one before. In weeks 1 to 5 you watch recorded lessons in Moodle, get help at office hours, and meet with staff once a week for a check-in. This policy explains how we count your hours, what to do if you fall behind, and what you need to finish the program.",
          "es": "Cada semana de este programa tiene 20 horas. Su condado cuenta estas horas para WorkFirst NJ. Además, cada lección se apoya en la anterior. En las semanas 1 a 5 usted ve lecciones grabadas en Moodle, recibe ayuda en las horas de apoyo (office hours) y se reúne con el personal una vez por semana para una reunión de seguimiento. Esta política explica cómo contamos sus horas, qué hacer si se atrasa y qué necesita para terminar el programa."
        }
      ],
      "items": []
    },
    {
      "title": {
        "en": "1. Your week and how we record your hours",
        "es": "1. Su semana y cómo anotamos sus horas"
      },
      "numbered": true,
      "paras": [],
      "items": [
        {
          "en": "Monday: the week opens. We post the week's four lessons and the check-in times in Moodle.",
          "es": "Lunes: la semana abre. Publicamos en Moodle las cuatro lecciones de la semana y los horarios de las reuniones de seguimiento."
        },
        {
          "en": "Any day: watch each lesson, read, practice and turn in the task. Each lesson is about 3 hours of work. Its 3 hours count when you turn in the task.",
          "es": "Cualquier día: vea cada lección, lea, practique y entregue la tarea. Cada lección es de unas 3 horas de trabajo. Sus 3 horas cuentan cuando entrega la tarea."
        },
        {
          "en": "Office hours: Tuesday and Thursday, 10:00 am to 1:00 pm, on campus or on Teams, and Friday, 11:30 am to 1:00 pm, on Teams. Office hours are your choice. The time you spend there counts toward your 20 hours.",
          "es": "Horas de apoyo: martes y jueves, de 10:00 am a 1:00 pm, en el campus o en Teams, y viernes, de 11:30 am a 1:00 pm, en Teams. Usted decide si va. El tiempo que pasa ahí cuenta para sus 20 horas."
        },
        {
          "en": "Weekly check-in: required. Once a week you meet with a staff member for 10 to 15 minutes, at office hours, on Teams, or by phone if that is the only way that week. You also send a short check-in form in Moodle. Next week's lessons open after you send it.",
          "es": "Reunión de seguimiento semanal: obligatoria. Una vez por semana usted se reúne con alguien del personal por 10 a 15 minutos, en las horas de apoyo, en Teams, o por teléfono si esa semana es la única forma. También envía un formulario corto de seguimiento en Moodle. Las lecciones de la próxima semana abren cuando usted lo envía."
        },
        {
          "en": "Sunday at 11:59 pm: the week closes. Your tasks, your practice and your weekly check are due.",
          "es": "Domingo a las 11:59 pm: la semana cierra. Sus tareas, su práctica y su comprobación semanal se entregan a esta hora."
        },
        {
          "en": "We record office hours, check-ins and career sessions in Moodle Attendance, to the minute. On campus, you mark yourself present with the QR code on the screen. On Teams, staff mark you from the meeting list.",
          "es": "Anotamos al minuto las horas de apoyo, las reuniones de seguimiento y las sesiones de carrera en la Asistencia de Moodle. En el campus, usted marca su asistencia con el código QR de la pantalla. En Teams, el personal le marca según la lista de la reunión."
        },
        {
          "en": "Career services count 2 hours a week: the Friday career workshop on Teams, 10:00 to 11:30 am (1.5 hours), plus 30 minutes with your Career Services Advisor, as a career check-in or a one-on-one meeting. This time is recorded apart from your weekly check-in.",
          "es": "Los servicios de carrera cuentan 2 horas por semana: el taller de carrera del viernes en Teams, de 10:00 a 11:30 am (1.5 horas), más 30 minutos con su Asesor(a) de Servicios de Carrera, como reunión de seguimiento de carrera o reunión individual. Este tiempo se anota aparte de su reunión de seguimiento semanal."
        },
        {
          "en": "Moodle practice counts 30 minutes for each of the 4 weekly practice items you finish, up to 2 hours a week.",
          "es": "La práctica en Moodle cuenta 30 minutos por cada una de las 4 actividades de práctica semanales que termine, hasta 2 horas por semana."
        },
        {
          "en": "Office hours and check-ins are not recorded. Lessons are recorded by the instructor, with no learners on screen.",
          "es": "Las horas de apoyo y las reuniones de seguimiento no se graban. El instructor graba las lecciones sin participantes en pantalla."
        },
        {
          "en": "MMT sends your weekly hours to your county caseworker.",
          "es": "MMT envía sus horas de cada semana a su trabajador(a) de caso del condado."
        }
      ]
    },
    {
      "title": {
        "en": "2. If you will miss your check-in or fall behind",
        "es": "2. Si va a faltar a su reunión de seguimiento o se atrasa"
      },
      "numbered": false,
      "paras": [],
      "items": [
        {
          "en": "Tell us ahead of time, by email to contact@mercermedtech.com or in person.",
          "es": "Avísenos antes, por correo electrónico a contact@mercermedtech.com o en persona."
        },
        {
          "en": "If you miss your check-in, we send you a text the same day and call you the next day to check on you and plan.",
          "es": "Si falta a su reunión de seguimiento, le enviamos un mensaje de texto el mismo día y le llamamos al día siguiente para saber cómo está y planear."
        },
        {
          "en": "If a week closes and a lesson's task is not turned in, we reach out to help you plan a make-up.",
          "es": "Si la semana cierra y no entregó la tarea de una lección, nos comunicamos con usted para ayudarle a planear la recuperación."
        }
      ]
    },
    {
      "title": {
        "en": "3. Make-up rules",
        "es": "3. Reglas de recuperación"
      },
      "numbered": true,
      "paras": [],
      "items": [
        {
          "en": "If a lesson's task is not turned in when the week closes, make it up within 7 days.",
          "es": "Si no entregó la tarea de una lección cuando la semana cierra, recupérela dentro de los 7 días siguientes."
        },
        {
          "en": "To make up a lesson, finish it (watch the video, read, and turn in the task), then come to a check-in. Staff go over the work with you.",
          "es": "Para recuperar una lección, termínela (vea el video, lea y entregue la tarea) y después venga a una reunión de seguimiento. El personal revisa el trabajo con usted."
        },
        {
          "en": "Make-up counts toward finishing the course.",
          "es": "La recuperación cuenta para terminar el curso."
        },
        {
          "en": "The lesson's hours count in the week you turn in the task. Time you spend on a make-up at office hours also counts as office hours.",
          "es": "Las horas de la lección cuentan en la semana en que entrega la tarea. El tiempo que pasa recuperando en las horas de apoyo también cuenta como horas de apoyo."
        },
        {
          "en": "Your county decides how late hours count toward your WorkFirst NJ hours.",
          "es": "Su condado decide cómo cuentan las horas tardías para sus horas de WorkFirst NJ."
        },
        {
          "en": "If you miss your check-in, do one before the next week opens.",
          "es": "Si falta a su reunión de seguimiento, haga una antes de que abra la próxima semana."
        },
        {
          "en": "You can make up to 3 lessons (9 hours). If you need more, you meet with your Career Services Advisor to make a plan. One choice is to move to the same week of the next cohort (5 weeks later), with an update to your IEP.",
          "es": "Puede recuperar hasta 3 lecciones (9 horas). Si necesita más, se reúne con su Asesor(a) de Servicios de Carrera para hacer un plan. Una opción es pasar a la misma semana del siguiente grupo (5 semanas después), con una actualización de su IEP."
        }
      ]
    },
    {
      "title": {
        "en": "4. Holidays",
        "es": "4. Días feriados"
      },
      "numbered": false,
      "paras": [
        {
          "en": "Recorded lessons do not stop for a holiday. If a holiday falls on an office-hours day (Tuesday, Thursday or Friday), we move those office hours to another day that week and tell you in the Monday announcement. The week still closes on Sunday, and your week still has 20 hours.",
          "es": "Las lecciones grabadas no se detienen por un día feriado. Si un feriado cae en un día de horas de apoyo (martes, jueves o viernes), pasamos esas horas de apoyo a otro día de la misma semana y se lo decimos en el anuncio del lunes. La semana sigue cerrando el domingo y su semana sigue teniendo 20 horas."
        }
      ],
      "items": []
    },
    {
      "title": {
        "en": "5. What you need to finish the core course",
        "es": "5. Lo que necesita para terminar el curso principal"
      },
      "numbered": true,
      "paras": [
        {
          "en": "You receive the MMT Certificate of Completion when you have done all four:",
          "es": "Usted recibe el Certificado de Finalización de MMT cuando cumple los cuatro puntos:"
        },
        {
          "en": "\"Not yet\" on a check or a capstone is not the end. You get a short corrective task and a time at office hours within 48 hours, and you can try again until you reach Meets.",
          "es": "\"Todavía no\" en una comprobación o en un proyecto final no es el final. Usted recibe una tarea corta de corrección y un turno en las horas de apoyo dentro de 48 horas, y puede intentarlo otra vez hasta llegar a Cumple."
        },
        {
          "en": "After the core course, you start the NJIT AI Literacy Microcredential in week 6. The program is fully complete when you have the MMT Certificate of Completion and have finished all 10 NJIT modules.",
          "es": "Después del curso principal, usted empieza la microcredencial de IA de NJIT (NJIT AI Literacy Microcredential) en la semana 6. El programa está completo cuando tiene el Certificado de Finalización de MMT y terminó los 10 módulos de NJIT."
        }
      ],
      "items": [
        {
          "en": "At least 85% of the 60 core lesson hours, on time or made up (51 hours or more, which is 17 of the 20 lessons), and a check-in every week in weeks 1 to 5.",
          "es": "Por lo menos el 85% de las 60 horas de lecciones principales, a tiempo o recuperadas (51 horas o más, es decir, 17 de las 20 lecciones), y una reunión de seguimiento cada semana de las semanas 1 a 5."
        },
        {
          "en": "Meets on all 5 weekly checks.",
          "es": "Cumple en las 5 comprobaciones semanales."
        },
        {
          "en": "Meets on all 6 capstone products (resume, cover letter, household budget, slide talk, professional email to an employer, and Job Source or My Career NJ profile).",
          "es": "Cumple en los 6 proyectos finales (currículum, carta de presentación, presupuesto del hogar, presentación corta, correo profesional a un empleador y perfil en Job Source o My Career NJ)."
        },
        {
          "en": "The Northstar post check, taken with a proctor in week 5: on campus at office hours, or in a scheduled online time on Teams with a proctor watching, as Northstar's rules require.",
          "es": "La evaluación final de Northstar, hecha con supervisión en la semana 5: en el campus en las horas de apoyo, o en un horario fijo en línea por Teams con una persona que supervisa, como lo piden las reglas de Northstar."
        }
      ]
    },
    {
      "title": {
        "en": "6. Our goal",
        "es": "6. Nuestra meta"
      },
      "numbered": false,
      "paras": [
        {
          "en": "We aim for every cohort to complete at least 85% of its hours. We will help you get there with reminders, weekly check-ins, recorded lessons you can watch again, and office hours.",
          "es": "Queremos que cada grupo complete por lo menos el 85% de sus horas. Le ayudaremos a lograrlo con recordatorios, reuniones de seguimiento semanales, lecciones grabadas que puede ver otra vez y horas de apoyo."
        }
      ],
      "items": []
    }
  ],
  "attendanceStatement": {
    "en": "I have read this policy, or had it read to me, in the language I chose. I understand it and I have received a copy.",
    "es": "Leí esta política, o me la leyeron, en el idioma que elegí. La entiendo y recibí una copia."
  }
};
