/**
 * SPANISH WORDING FOR THE WHOLE SITE.
 *
 * Voz: usted, palabras sencillas, frases cortas. Nunca se da por sentado que
 * la persona no sabe algo. Sin signos de exclamacion y sin rayas largas.
 *
 * Se dejan en ingles los nombres oficiales que la persona vera en papeles:
 * TANF, SNAP, WorkFirst New Jersey, One-Stop Career Center, ETPL, NHA, MedCA,
 * y el nombre oficial de cada programa entre parentesis la primera vez.
 *
 * El glosario de terminos (capacitacion, grupo, pasantia, practica,
 * trabajador de caso, costo del curso, microcertificado...) esta en
 * design.md seccion 15. No invente un sinonimo nuevo: use el del glosario.
 *
 * RULE: edit this file together with en.ts. "npm run check:i18n" checks it.
 */
import { site, dlt } from '../data/site';
import type { Dictionary } from './en';

export const es: Dictionary = {
  /* ---------- Cambio de idioma y textos compartidos ---------- */
  ui: {
    languageLabel: 'Idioma',
    thisLanguage: 'Español',
    otherLanguage: 'English',
    switchAria: 'View this page in English',
    menuLabel: 'Menú',
    primaryNavLabel: 'Principal',
    logoAlt: site.name,
    homeAria: `Inicio de ${site.name}`,
    skipLink: 'Ir al contenido principal',
    floatingCallLabel: 'Llámenos',
    callAria: `Llamar a ${site.name}`,
    fundingSentenceLocal:
      'Los fondos para esta iniciativa provienen del Departamento de Trabajo y Desarrollo de la Fuerza Laboral de Nueva Jersey.',
  },

  nav: {
    home: 'Inicio',
    about: 'La escuela',
    med: 'Med',
    tech: 'Tech',
    enroll: 'Inscripción',
    faculty: 'Personal',
    requestInfo: 'Pedir información',
  },

  dltNav: {
    qualify: 'Quién califica',
    learn: 'Qué aprende',
    enroll: 'Cómo inscribirse',
    partners: 'Para agencias',
  },

  footer: {
    explore: 'Secciones',
    contact: 'Contacto',
    follow: 'Búsquenos en internet',
    credentialFinder: 'Vea nuestra ficha en Credential Finder',
    brandLine:
      'Capacitación en salud y computación en Lawrenceville, NJ. Med y Tech. Dos caminos hacia un mejor trabajo.',
    links: {
      home: 'Inicio',
      about: 'La escuela',
      med: 'Programas Med',
      tech: 'Programas Tech',
      dlt: 'Capacitación en Habilidades Digitales',
      enroll: 'Inscripción',
      faculty: 'Personal',
      contact: 'Pedir información',
    },
    homeLink: 'Inicio de Mercer Med Tech',
    licensingLine:
      'Mercer Med Tech es una escuela vocacional privada aprobada por el estado, con licencia del Departamento de Trabajo y Desarrollo de la Fuerza Laboral de Nueva Jersey, y está en la Lista de Proveedores de Capacitación Elegibles de Nueva Jersey (ETPL).',
  },

  /* ---------- Página principal ---------- */
  home: {
    seo: {
      title: 'Mercer Med Tech | Salud y computación en Lawrenceville, NJ',
      description:
        'Escuela aprobada por el estado en Lawrenceville, NJ. Certificación en salud y Capacitación en Habilidades Digitales sin costo si califica. (609) 712-5499.',
      keywords:
        'mercer med tech, clases de computacion gratis nueva jersey, habilidades digitales nj, alfabetizacion digital nj, inteligencia artificial, asistente medico lawrenceville nj, flebotomia nj, tecnico ekg, tecnico en cuidado del paciente, cna, asistente de medicamentos, capacitacion tanf snap',
      ogTitle: 'Salud y computación en Lawrenceville, NJ',
      ogDescription:
        'Una escuela, dos caminos hacia un mejor trabajo. Programas de certificación en salud y Capacitación en Habilidades Digitales sin costo si califica.',
      twitterDescription:
        'Programas de certificación en salud en Lawrenceville, NJ, y Capacitación en Habilidades Digitales sin costo si califica.',
      schemaDescription:
        'Mercer Med Tech es una escuela vocacional privada aprobada por el estado, en Lawrenceville, NJ. La rama Med es certificación en salud: Asistente Médico, Flebotomía, Técnico en Cuidado del Paciente, Electrocardiogramas, Asistente de Enfermería Certificado y Asistente Certificado de Medicamentos. La rama Tech es la Capacitación en Habilidades Digitales, sin costo para residentes de Nueva Jersey que califican. Mercer Med Tech está en la Lista de Proveedores de Capacitación Elegibles de Nueva Jersey (ETPL).',
      catalogName: 'Programas de capacitación Med y Tech',
      dltCatalogDescription:
        'Capacitación en computación y búsqueda de trabajo, sin costo para residentes de Nueva Jersey que califican. Cubre lo básico de la computadora y de internet, Microsoft Office y Google Workspace, seguridad en línea, inteligencia artificial, manejo del dinero y preparación para el trabajo. Cada persona empieza con una revisión de lo que ya sabe, para que la clase vaya a su nivel.',
    },

    announce: {
      label: 'Anuncio',
      message:
        'La Capacitación en Habilidades Digitales (Digital Literacy Training) abre inscripciones próximamente. Sin costo si califica.',
      ctaLabel: 'Vea si califica',
    },

    hero: {
      headingBefore: 'Una escuela. ',
      headingAccent: 'Dos caminos',
      headingAfter: ' hacia un mejor trabajo.',
      lead: 'En Lawrenceville capacitamos a personas para los dos tipos de trabajo que la zona central de Nueva Jersey está contratando: el cuidado de personas y el trabajo con computadoras. Elija una certificación en salud, o tome la Capacitación en Habilidades Digitales, que no le cuesta nada si califica.',
      trustLabel: 'Qué es la escuela',
      trust: [
        { icon: 'fas fa-landmark', label: 'Aprobada por el estado' },
        { icon: 'fas fa-check-circle', label: 'Aparece en Credential Finder' },
        {
          icon: 'fas fa-clipboard-check',
          label: 'En la Lista ETPL de Nueva Jersey',
        },
        { icon: 'fas fa-briefcase', label: 'Ayuda para encontrar trabajo' },
      ],
      medPanel: {
        label: 'Med',
        heading: 'Certificación en salud',
        body: 'Certifíquese para trabajar en clínicas, hospitales y residencias de cuidado. Grupos pequeños e instructores que han hecho el trabajo.',
        chipsLabel: 'Programas de la rama Med',
        chips: [
          'Asistente Médico',
          'Flebotomía',
          'Cuidado del Paciente',
          'Electrocardiogramas (EKG)',
        ],
        ctaLabel: 'Ver los programas Med',
      },
      techPanel: {
        label: 'Tech',
        heading: 'Computación y ayuda para encontrar trabajo',
        body: 'Aprenda la computación que los empleadores esperan, desde lo básico, y reciba ayuda para buscar trabajo cuando llegue el momento.',
        chipsLabel: 'Qué cubre la rama Tech',
        chips: [
          'Habilidades Digitales',
          'Inteligencia artificial',
          'Microsoft Office y Google Workspace',
          'Ayuda para encontrar trabajo',
        ],
        ctaLabel: 'Ver la rama Tech',
      },
      quietBefore: '¿No sabe cuál le conviene? ',
      quietLinkLabel: 'Pregúntenos',
      quietAfter: ' y lo vemos juntos.',
    },

    enroll: {
      sectionTitle: 'Inscríbase en Mercer Med Tech',
      med: {
        badge: 'Inscripciones todo el año',
        titleAccent: 'Programas de salud',
        titleRest: ', con inscripciones todo el año',
        subtitle:
          'Certifíquese en nuestro campus de Lawrenceville. Grupos pequeños, instructores que han hecho el trabajo y mucha práctica con equipo real, con pasantía (externship) en los programas que la incluyen.',
        programsLabel: 'Programas de salud que ofrecemos',
        formatLabel: 'Formato',
        formatValue: 'Presencial, con algo de apoyo en línea',
        locationLabel: 'Dirección',
        programsCta: 'Ver los programas',
        contactCta: 'Preguntar por fechas y costo',
        scheduleLabel: 'Cuándo empiezan los próximos grupos',
      },
      tech: {
        badge: 'Próximamente · Sin costo si califica',
        titleAccent: 'Capacitación en Habilidades Digitales',
        titleRest: ', inscripciones próximamente',
        subtitle:
          'Empezamos con una revisión corta de lo que usted ya sabe, para que la clase vaya a su nivel. De ahí cubre Microsoft Office y Google Workspace, seguridad en línea, inteligencia artificial y manejo del dinero, y trabaja hacia un certificado reconocido por la industria. Las clases son presenciales en nuestro campus de Lawrenceville, con apoyo en línea, y alguien de aquí le ayuda a buscar trabajo.',
        costLabel: 'Costo',
        costValue: 'Sin costo si califica',
        lengthLabel: 'Duración',
        lengthValue: 'Unas 5 a 6 semanas',
        sessionsLabel: 'Sesiones informativas',
        sessionsValue: 'Pronto compartiremos los detalles',
        locationLabel: 'Dirección',
        qualifyLabel: 'Quién califica:',
        qualifyText:
          'Usted vive en Nueva Jersey, tiene 18 años o más, recibe TANF o SNAP y vive en el condado de Hunterdon, Middlesex, Monmouth, Mercer, Ocean, Somerset o Union.',
        featuresLabel: 'Qué cubre la capacitación',
        features: [
          { icon: 'fas fa-robot', label: 'Inteligencia artificial' },
          { icon: 'fas fa-file-word', label: 'Microsoft Office y Google Workspace' },
          { icon: 'fas fa-shield-alt', label: 'Seguridad en línea' },
          { icon: 'fas fa-piggy-bank', label: 'Manejo del dinero' },
          { icon: 'fas fa-comments', label: 'Orientación laboral' },
          { icon: 'fas fa-briefcase', label: 'Ayuda para encontrar trabajo' },
        ],
        qualifyCta: 'Vea si califica',
        callCta: `Llame al ${site.phone.display}`,
      },
    },

    about: {
      heading: 'Sobre Mercer Med Tech',
      imageAlt: 'Un salón de clases en el campus de Mercer Med Tech en Lawrenceville',
      paragraphs: [
        'Mercer Med Tech es una escuela vocacional privada y pequeña en Lawrenceville. El Departamento de Trabajo y Desarrollo de la Fuerza Laboral de Nueva Jersey nos da la licencia y aprueba lo que enseñamos. Empezamos capacitando a personas para trabajos de salud, y lo seguimos haciendo, en grupos pequeños, con equipo real y con instructores que han hecho ese trabajo.',
        'El nombre dice el resto. Med es el lado de la salud. Tech es el lado de la computación, que hoy es la Capacitación en Habilidades Digitales, que damos junto con el Departamento de Trabajo y Desarrollo de la Fuerza Laboral de Nueva Jersey, sin costo para quien califica. La zona central de Nueva Jersey contrata en las dos áreas, y las dos las enseñamos igual: practicando y cerca de lo que el trabajo de verdad pide.',
      ],
      medCta: 'Ver los programas Med',
      dltCta: 'Leer sobre las Habilidades Digitales',
    },

    programs: {
      heading: 'Nuestros programas',
      intro:
        'Dos ramas en una sola escuela. Certificación en salud del lado Med y computación del lado Tech.',
      med: {
        tag: 'Rama Med',
        heading: 'Programas de salud',
        intro:
          'Programas de certificación con grupos pequeños y mucha práctica. Algunos incluyen pasantía.',
        detailsLabel: 'Ver los detalles',
        prevLabel: 'Programa anterior',
        nextLabel: 'Programa siguiente',
        swipeLabel: 'Deslice para ver más',
        dotLabel: 'Ir al programa',
        trackLabel: 'Programas de salud',
        notesHeading: 'De dónde vienen estas cifras',
        notes: [
          'Los sueldos y el crecimiento de empleo vienen del Occupational Outlook Handbook de la Oficina de Estadísticas Laborales de Estados Unidos, mayo de 2024.',
          'El caso de EKG es distinto. La Oficina cuenta a los técnicos en electrocardiogramas junto con los tecnólogos cardiovasculares, que ganan más porque casi todos tienen un título de dos años. El rango de $42,000 a $54,000 que mostramos es para personas con certificado, como quienes se gradúan aquí.',
        ],
      },
      tech: {
        tag: 'Rama Tech',
        heading: 'Capacitación en computación',
        intro:
          'Computación, inteligencia artificial y ayuda para encontrar trabajo, para quien quiere un empleo que use la computadora todos los días.',
        chips: [
          'Inteligencia artificial',
          'Microsoft Office y Google Workspace',
          'Seguridad en línea',
          'Manejo del dinero',
          'Orientación laboral',
        ],
        modulesLabel: 'Qué aprende',
        modules: [
          { icon: 'fas fa-desktop', label: 'Lo básico de la computadora' },
          { icon: 'fas fa-envelope', label: 'Internet, correo electrónico y comunicación en línea' },
          { icon: 'fas fa-file-word', label: 'Microsoft Office y Google Workspace' },
          { icon: 'fas fa-shield-alt', label: 'Seguridad en línea y ciberseguridad básica' },
          { icon: 'fas fa-robot', label: 'Inteligencia artificial' },
          { icon: 'fas fa-piggy-bank', label: 'Manejo del dinero' },
          { icon: 'fas fa-briefcase', label: 'Preparación para el trabajo' },
        ],
        sessionsLine:
          'Inscripciones próximamente. Pronto compartiremos los detalles de las próximas sesiones informativas.',
        readMoreCta: 'Leer sobre las Habilidades Digitales',
        callCta: `Llame al ${site.phone.display}`,
      },
    },

    tuition: {
      badge: 'Cuánto cuesta',
      heading: 'Cuánto cuesta cada programa',
      intro:
        'Aquí está el precio de cada programa, claro y desde el principio. La Capacitación en Habilidades Digitales tiene fondos de una subvención, así que si califica no le cuesta nada. Nosotros no damos ayuda económica propia, pero sí aceptamos subvenciones de afuera, incluidas las del One-Stop Career Center y del Departamento de Trabajo de Nueva Jersey.',
      caption: 'Costo y duración de los programas de Mercer Med Tech',
      columns: {
        program: 'Programa',
        hours: 'Horas',
        length: 'Duración',
        cost: 'Costo',
        examFee: 'Costo del examen',
      },
      note: 'El costo del examen va aparte del precio que se muestra. El precio de Asistente Médico incluye los libros y una cuota administrativa de $150, que no se devuelve. La Capacitación en Habilidades Digitales tiene fondos de una subvención, así que si califica no paga nada. El calendario de reembolsos está en el catálogo de la escuela y en su Acuerdo de Inscripción, y lo revisamos con usted antes de que firme.',
      contactCta: 'Preguntar por fechas y costo',
      grantsCta: 'Ver las subvenciones',
    },

    why: {
      badge: 'Apoyo al estudiante',
      heading: 'Por qué Mercer Med Tech',
      intro:
        'Una escuela vocacional privada aprobada por el estado. Instructores de verdad, grupos pequeños y alguien que contesta el teléfono.',
      cards: [
        {
          icon: 'fas fa-landmark',
          heading: 'Con licencia del estado',
          body: 'El Departamento de Trabajo y Desarrollo de la Fuerza Laboral de Nueva Jersey nos da la licencia y aprueba lo que enseñamos. Mercer Med Tech está en la Lista de Proveedores de Capacitación Elegibles de Nueva Jersey (ETPL).',
        },
        {
          icon: 'fas fa-briefcase',
          heading: 'Ayuda para encontrar trabajo',
          body: 'Trabajamos su currículum con usted, nos sentamos con usted mientras llena solicitudes en internet, y practicamos entrevistas hasta que le resulten normales. Estamos conectados con el sistema One-Stop de Nueva Jersey para avisos de empleo.',
        },
        {
          icon: 'fas fa-comments',
          heading: 'Alguien con quien hablarlo',
          body: 'Siéntese con nosotros y vemos qué rama le conviene, qué pide el certificado y qué viene después.',
        },
        {
          icon: 'fas fa-language',
          heading: 'Hablamos español',
          body: 'Tenemos personal que habla español para ayudarle a inscribirse y para acompañarle durante el programa.',
        },
        {
          icon: 'fas fa-clock',
          heading: 'Horarios de clase',
          body: 'El horario depende del programa. Llámenos y le decimos los días y las horas del que le interesa.',
        },
        {
          icon: 'fas fa-users',
          heading: 'Grupos pequeños',
          body: 'Tiene tiempo con el instructor, y practica con el equipo y en la computadora, no solo en un libro.',
        },
        {
          icon: 'fas fa-hand-holding-usd',
          heading: 'Aceptamos subvenciones',
          body: 'No damos ayuda económica propia. Sí aceptamos subvenciones de afuera, incluidas las del One-Stop Career Center y del Departamento de Trabajo de Nueva Jersey. Tráiganos lo que le dio su trabajador de caso (caseworker).',
        },
        {
          icon: 'fas fa-wheelchair',
          heading: 'Puede entrar y moverse',
          body: 'Estacionamiento accesible y rampa en la entrada, baños accesibles, sala de descanso y aire acondicionado.',
        },
      ],
      admissions: {
        heading: 'Qué necesita para inscribirse en un programa Med',
        intro: 'Cuatro cosas. Esa es toda la lista.',
        items: [
          { icon: 'fas fa-id-card', title: '17 años o más', body: 'Para su primer día de clase.' },
          {
            icon: 'fas fa-graduation-cap',
            title: 'Diploma de escuela secundaria (high school) o GED',
            body: 'Si no lo tiene, pregúntenos por el examen Ability to Benefit.',
          },
          {
            icon: 'fas fa-file-signature',
            title: 'Inscribirse en persona',
            body: 'Traiga una identificación con foto, comprobante de sus estudios y su primer pago.',
          },
          {
            icon: 'fas fa-clock',
            title: 'Inscribirse con tiempo',
            body: 'Al menos 5 días hábiles antes de que empiece la clase, o 20 días si usa una subvención.',
          },
        ],
        ctaLabel: 'Pida que le llamemos',
        metaBefore: 'O llame al ',
        metaAfter:
          ' y pregunte por admisiones. La Capacitación en Habilidades Digitales tiene otros requisitos.',
        metaLinkLabel: 'Vea si califica',
      },
    },

    grants: {
      med: {
        imageAlt: 'Un salón de práctica clínica de Mercer Med Tech',
        heading: 'Cómo pagar un programa Med',
        body: 'Nosotros no damos subvenciones, becas ni ayuda económica propia. Sí aceptamos subvenciones de afuera, incluidas las del One-Stop Career Center y del Departamento de Trabajo de Nueva Jersey. Tráiganos lo que le dio su trabajador de caso y le mostramos cómo usarlo. Mercer Med Tech está en la Lista de Proveedores de Capacitación Elegibles de Nueva Jersey (ETPL), así que pregúntele a su trabajador de caso qué programas cubre su subvención.',
        bullets: [
          {
            icon: 'fas fa-award',
            label: 'Aceptamos subvenciones del One-Stop Career Center y del Departamento de Trabajo de Nueva Jersey',
          },
          { icon: 'fas fa-comments-dollar', label: 'Le ayudamos a solicitarlas' },
        ],
        loanHeading: 'Si saca un préstamo',
        loanBody:
          'Si saca un préstamo con ayuda de la escuela, usted tiene que pagarlo completo. Eso vale termine o no el programa. Si se retira, avise usted a la institución que le dio el préstamo. Nosotros enviamos a esa institución el reembolso que le corresponda, según nuestra política, pero lo que quede debiendo en el pagaré le toca pagarlo a usted.',
        loanInvite:
          '¿Le preocupa el costo? Llámenos. Lo revisamos con usted antes de que firme nada.',
        ctaLabel: 'Preguntar cómo pagarlo',
      },
      tech: {
        heading: 'La Capacitación en Habilidades Digitales tiene fondos de una subvención',
        body: 'Si califica, no le cuesta nada. No paga el costo del curso ni el del examen. Confirmamos su elegibilidad con la agencia de servicios sociales de su condado, y le ayudamos a ver si califica.',
        ctaLabel: 'Vea si califica',
      },
    },

    faculty: {
      heading: 'Con quién va a tratar',
      intro: 'Una escuela pequeña. Va a conocer a la persona que contesta el teléfono.',
      people: [
        {
          name: 'Shazia Qazi',
          role: 'Directora de Programas y Directora de Educación',
          bio: 'Shazia dirige los programas y la operación diaria de la escuela. Viene de la administración de consultorios médicos, la facturación y la codificación. Casi siempre es ella quien le acompaña en la inscripción.',
          icon: 'fas fa-user-md',
        },
      ],
    },

    organizations: {
      heading: 'Con quién trabajamos',
      intro:
        'Estas son las agencias que nos dan la licencia, registran nuestros certificados y administran nuestros exámenes.',
      list: [
        'New Jersey Department of Health',
        'New Jersey Department of Labor',
        'Department of Labor Opportunity Partnership Grant',
        'New Jersey Board of Nursing',
        'National Healthcareer Association',
        'PSI Test Centers',
        'MedCA Certifications',
        'CNJHS LLC',
        'Credential Engine Registry',
      ],
    },

    contact: {
      eyebrow: 'Pida una llamada',
      heading: 'Nosotros le llamamos',
      intro:
        'Llene este formulario y le llamamos con las fechas, el costo y lo que necesita para inscribirse. Preguntar no cuesta nada, y no se está comprometiendo a nada.',
      callLabel: 'Teléfono',
      emailLabel: 'Correo',
      visitLabel: 'Dirección',
      nameLabel: 'Su nombre',
      namePlaceholder: 'Nombre y apellido',
      phoneLabel: 'Número de teléfono',
      phonePlaceholder: '(609) 555 1234',
      emailFieldLabel: 'Correo electrónico',
      emailPlaceholder: 'usted@ejemplo.com',
      programLabel: '¿Qué programa?',
      programPlaceholder: 'Elija uno',
      bestTimeLabel: '¿A qué hora le llamamos?',
      bestTimePlaceholder: 'Cualquier hora sirve',
      bestTimeOptions: [
        'Mañana (9:00 AM a 12:00 PM)',
        'Tarde (12:00 PM a 5:00 PM)',
        'Noche (5:00 PM a 8:00 PM)',
        'Cualquier hora',
      ],
      notSureOption: 'Todavía no lo he decidido',
      messageLabel: '¿Algo más?',
      messagePlaceholder: 'Por ejemplo: cuánto cuesta, cuándo empieza la clase, si hay estacionamiento.',
      optional: 'opcional',
      consent:
        'Sí, pueden llamarme o escribirme sobre esto. No compartimos su información con nadie.',
      submit: 'Pedir una llamada',
      sending: 'Enviando',
      successTitle: 'Listo. Ya tenemos su mensaje.',
      successBody: `Alguien de la escuela le va a llamar. Si prefiere no esperar, llámenos al ${site.phone.display}.`,
      errorTitle: 'No pudimos enviarlo.',
      errorBody: `Disculpe, algo falló de nuestro lado. Llámenos al ${site.phone.display} o escriba a ${site.email} y seguimos desde ahí.`,
      iframeTitle: 'Destino del envío del formulario',
    },

    modals: {
      closeLabel: 'Cerrar',
      closeButtonLabel: 'Cerrar',
      pageLinkLabel: 'Abrir la página completa',
    },

    waitlistCta: 'Anóteme en la lista',
  },

  /* ---------- Capacitación en Habilidades Digitales ---------- */
  dlt: {
    seo: {
      title: 'Capacitación en Habilidades Digitales | Mercer Med Tech',
      description:
        'Clases de computación, inteligencia artificial y búsqueda de trabajo en Lawrenceville, NJ, sin costo para adultos con TANF o SNAP. (609) 712-5499.',
      keywords:
        'habilidades digitales nueva jersey, alfabetizacion digital nueva jersey, clases de computacion sin costo, inteligencia artificial, capacitacion tanf snap nj, workfirst new jersey, lawrenceville nj, preparacion para el trabajo, mercer med tech',
      ogTitle: 'Computación e inteligencia artificial sin costo si califica',
      ogDescription:
        'Aprenda computación, inteligencia artificial y manejo del dinero en unas 5 a 6 semanas en Lawrenceville, NJ. Inscripciones próximamente. (609) 712-5499.',
      twitterDescription:
        'Clases de computación y búsqueda de trabajo en Lawrenceville, NJ, sin costo para adultos de Nueva Jersey con TANF o SNAP. Inscripciones próximamente.',
      schemaDescription:
        'Capacitación en computación y búsqueda de trabajo para residentes de Nueva Jersey que califican, sin costo. Cada persona empieza con una revisión de lo que ya sabe, para que la clase vaya a su nivel. Cubre lo básico de la computadora, internet y correo electrónico, Microsoft Office y Google Workspace, seguridad en línea y ciberseguridad básica, inteligencia artificial, manejo del dinero y preparación para el trabajo. Los participantes trabajan hacia un certificado reconocido por la industria, incluido un microcertificado en inteligencia artificial, y la ayuda para encontrar trabajo sigue con llamadas a los 30, 60 y 90 días después de empezar a trabajar.',
    },

    hero: {
      eyebrowTrailing: 'Rama Tech',
      headingBefore: 'Aprenda computación para el trabajo. ',
      headingAccent: 'Sin costo si califica.',
      lead: 'La Capacitación en Habilidades Digitales (Digital Literacy Training) de Mercer Med Tech le prepara para trabajos que usan la computadora todos los días. Empezamos con una revisión corta de lo que usted ya sabe, para que la clase vaya a su nivel. De ahí cubre Microsoft Office y Google Workspace, cómo protegerse en línea, inteligencia artificial y manejo del dinero. Sale con un certificado que le puede mostrar a un empleador, y con alguien de aquí ayudándole a buscar trabajo. Tiene fondos de una subvención, así que si califica no le cuesta nada.',
      chips: [
        { icon: 'fas fa-bullhorn', label: 'Inscripciones próximamente' },
        { icon: 'fas fa-tag', label: 'Sin costo si califica' },
        { icon: 'fas fa-hourglass-half', label: 'Unas 5 a 6 semanas' },
        { icon: 'fas fa-map-marker-alt', label: `${site.address.city}, ${site.address.region}` },
        { icon: 'fas fa-language', label: 'Inglés y español' },
      ],
      qualifyCta: 'Vea si califica',
      callCta: `Llame al ${site.phone.display}`,
      artLabel: 'Una computadora portátil, un certificado y una gráfica que sube',
    },

    strip: {
      heading: 'Sesiones informativas',
      note: 'Pronto compartiremos los detalles de las próximas sesiones informativas.',
      ctaLabel: 'Pida que le avisemos cuando abran las inscripciones',
      callLabel: 'Teléfono',
      whereLabel: 'Dónde',
    },

    qualify: {
      eyebrow: 'Quién califica',
      heading: 'Cuatro cosas para revisar',
      intro: 'Si las cuatro son ciertas para usted, es muy probable que califique.',
      checks: [
        {
          title: 'Vive en Nueva Jersey y tiene 18 años o más',
          body: '18 años o más en su primer día de clase.',
        },
        { title: 'Recibe TANF o SNAP ahora', body: 'Beneficios por medio de WorkFirst New Jersey.' },
        { title: 'Vive en uno de siete condados', body: 'Vea la lista abajo.' },
        {
          title: 'Quiere capacitarse y buscar trabajo',
          body: 'Puede venir a clase y trabajar con nosotros en la búsqueda de empleo.',
        },
      ],
      countiesHeading: 'Condados que atendemos',
      note: 'Confirmamos su elegibilidad con la agencia de servicios sociales de su condado. Usted no tiene que hacer ese trámite.',
      calloutStrong: '¿Tiene dudas? Llámenos.',
      calloutBefore: ' Le ayudamos a revisarlo. Llame al ',
      calloutAfter: ' y lo vemos con usted.',
    },

    learn: {
      eyebrow: 'Qué aprende',
      heading: 'Siete áreas de habilidades, en grupos pequeños',
      intro:
        'Todas son prácticas. Usted está frente a la computadora, no leyendo sobre ella. Antes de empezar revisamos lo que ya sabe, para que su capacitación empiece en el nivel que le corresponde.',
      cards: [
        {
          icon: 'fas fa-desktop',
          heading: 'Lo básico de la computadora',
          body: 'El mouse y el teclado, los archivos y las carpetas, y cómo cambiar la configuración de su equipo.',
        },
        {
          icon: 'fas fa-envelope',
          heading: 'Internet, correo electrónico y comunicación en línea',
          body: 'Buscar, navegar con seguridad, escribir correos de trabajo y reunirse en línea.',
        },
        {
          icon: 'fas fa-file-alt',
          heading: 'Microsoft Office y Google Workspace',
          body: 'Documentos, hojas de cálculo y presentaciones, en los dos programas que usan los empleadores.',
        },
        {
          icon: 'fas fa-shield-alt',
          heading: 'Seguridad en línea y ciberseguridad básica',
          body: 'Contraseñas, correos engañosos, estafas y cómo proteger sus cuentas y su información.',
        },
        {
          icon: 'fas fa-robot',
          heading: 'Inteligencia artificial',
          body: 'Cómo usar herramientas de inteligencia artificial en el trabajo, para qué sirven y en qué se equivocan.',
        },
        {
          icon: 'fas fa-piggy-bank',
          heading: 'Manejo del dinero',
          body: 'El banco desde el teléfono, llevar un presupuesto y reconocer una estafa antes de que le cueste.',
        },
        {
          icon: 'fas fa-briefcase',
          heading: 'Preparación para el trabajo',
          body: 'Su currículum, las solicitudes en internet, practicar la entrevista y una búsqueda de trabajo que usted pueda seguir por su cuenta.',
        },
      ],
    },

    outcomes: {
      eyebrow: 'Con qué sale',
      heading: 'Prueba de lo que sabe y un plan',
      cards: [
        {
          icon: 'fas fa-certificate',
          heading: 'Un certificado',
          body: 'Trabaja hacia un certificado reconocido por la industria, incluido un microcertificado en inteligencia artificial.',
        },
        {
          icon: 'fas fa-file-alt',
          heading: 'Un currículum terminado',
          body: 'Su currículum, listo para enviar y una dirección de correo profesional para enviarlo.',
        },
        {
          icon: 'fas fa-comments',
          heading: 'Práctica de entrevista',
          body: 'Practica primero con nosotros, para que la primera entrevista de verdad no sea su primera vez.',
        },
        {
          icon: 'fas fa-search',
          heading: 'Un plan de búsqueda',
          body: 'Dónde buscar, a qué empleos mandar su solicitud y cómo mantener la búsqueda.',
        },
        {
          icon: 'fas fa-handshake',
          heading: 'Alguien de su lado después',
          body: 'Sigue trabajando con nosotros uno a uno, le conectamos con empleadores, y cuando empiece a trabajar le llamamos a los 30, 60 y 90 días.',
        },
      ],
    },

    support: {
      eyebrow: 'Apoyo mientras se capacita',
      heading: 'Aquí no está por su cuenta',
      items: [
        {
          icon: 'fas fa-user-edit',
          body: 'En su primera semana, usted y su asesor escriben un plan juntos. Ahí queda qué busca lograr y qué necesita para lograrlo.',
        },
        { icon: 'fas fa-users', body: 'Grupos pequeños, para que tenga tiempo con el instructor.' },
        { icon: 'fas fa-language', body: 'Personal que habla inglés y español.' },
      ],
      panelHeading: 'Ayuda con lo que se le atraviese',
      panelIntro: 'Según lo que usted necesite, es posible que podamos ayudar con:',
      panelItems: [
        { icon: 'fas fa-laptop', body: 'Conexión a internet en casa.' },
        { icon: 'fas fa-bus', body: 'El transporte a la clase.' },
        { icon: 'fas fa-tshirt', body: 'Ropa para la entrevista.' },
        { icon: 'fas fa-id-card', body: 'El costo del examen y de la identificación.' },
      ],
      panelNote:
        'Lo que usted necesita lo vemos en su plan, en la primera semana. No hay pagos ni estipendios por asistir.',
    },

    enroll: {
      eyebrow: 'Cómo inscribirse',
      heading: 'Cuatro pasos, en orden',
      intro:
        'La Capacitación en Habilidades Digitales abre inscripciones próximamente. Llámenos y le decimos cuándo empieza el próximo grupo.',
      steps: [
        {
          title: 'Llámenos o escríbanos',
          body: `Llame al <a href="${site.phone.href}">${site.phone.display}</a> o escriba a <a href="mailto:${site.email}">${site.email}</a>. Pronto compartiremos los detalles de las próximas sesiones informativas.`,
        },
        {
          title: 'Confirmamos su elegibilidad',
          body: 'Revisamos con la agencia de servicios sociales de su condado. No necesita una referencia para empezar.',
        },
        {
          title: 'Revisamos lo que sabe y escribimos su plan',
          body: 'Una revisión corta de lo que ya sabe nos dice en qué nivel empezar. Después, en su primera semana, fijamos sus metas y vemos qué apoyo necesita.',
        },
        {
          title: 'Empieza la capacitación con su grupo',
          body: 'Presencial en el campus de Lawrenceville, con apoyo en línea, unas 5 a 6 semanas.',
        },
      ],
    },

    partners: {
      eyebrow: 'Para quien refiere',
      heading: 'Agencias del condado, One-Stop Career Centers y organizaciones comunitarias',
      intro: 'Trabajamos con la gente que ya conoce a sus clientes.',
      whoHeading: 'A quién referir',
      whoBody:
        'Residentes de Nueva Jersey de 18 años o más que reciben TANF o SNAP y viven en el condado de Hunterdon, Middlesex, Monmouth, Mercer, Ocean, Somerset o Union. A cada participante le hacemos una revisión de lo que ya sabe y empieza en el nivel que le corresponde, así que puede referir a alguien desde cualquier punto de partida. Mercer Med Tech está en la Lista de Proveedores de Capacitación Elegibles de Nueva Jersey (ETPL).',
      howHeading: 'Cómo referir',
      howItems: [
        { icon: 'fas fa-phone-alt', body: `Llame al <a href="${site.phone.href}">${site.phone.display}</a>.` },
        { icon: 'fas fa-envelope', body: `Escriba a <a href="mailto:${site.email}">${site.email}</a>.` },
        {
          icon: 'fas fa-calendar-check',
          body: 'Pronto compartiremos los detalles de las próximas sesiones informativas. No pedimos un formulario de referencia. Si su condado tiene sus propios pasos de admisión, díganos y trabajamos con ellos.',
        },
      ],
      reportHeading: 'Qué le reportamos',
      reportBody:
        'Con el consentimiento del participante, enviamos a su agencia reportes periódicos: si se inscribió, si está asistiendo, si obtuvo el certificado y si encontró trabajo.',
      contactHeading: 'Contacto',
      phoneLabel: 'Teléfono',
      campusLabel: 'Campus',
    },

    faq: {
      eyebrow: 'Preguntas',
      heading: 'Preguntas que nos hacen',
      items: [
        {
          question: '¿Tiene algún costo?',
          answer:
            'No. Tiene fondos de una subvención, así que si califica no le cuesta nada. Para ser claros: tampoco hay pagos ni estipendios por asistir.',
        },
        {
          question: '¿Cuándo puedo empezar?',
          answer:
            'La Capacitación en Habilidades Digitales abre inscripciones próximamente. Llámenos al (609) 712-5499 y le decimos cuándo empieza el próximo grupo, o pida que le avisemos cuando abran las inscripciones.',
        },
        {
          question: '¿Quién califica?',
          answer:
            'Necesita vivir en Nueva Jersey, tener 18 años o más, recibir TANF o SNAP por medio de WorkFirst New Jersey y vivir en el condado de Hunterdon, Middlesex, Monmouth, Mercer, Ocean, Somerset o Union. Nosotros confirmamos su elegibilidad con la agencia de servicios sociales de su condado.',
        },
        {
          question: '¿Necesito que alguien me refiera?',
          answer:
            'No. No necesita que un trabajador de caso (caseworker) le refiera. Llámenos al (609) 712-5499 y empezamos directamente con usted.',
        },
        {
          question: '¿Cuándo son las sesiones informativas?',
          answer:
            'Pronto compartiremos los detalles de las próximas sesiones informativas. Llámenos y le avisamos en cuanto se fije la siguiente.',
        },
        {
          question: '¿Necesito mi propia computadora?',
          answer:
            'No. Usa las computadoras de aquí. Si conectarse a internet en casa es un problema, díganos, y vemos qué podemos hacer dentro de su plan.',
        },
        {
          question: '¿Cuánto dura y cuál es el horario?',
          answer:
            'Unas 5 a 6 semanas. Llámenos y le decimos los días y las horas del próximo grupo.',
        },
        {
          question: '¿Es presencial?',
          answer:
            'Sí. La capacitación es presencial en nuestro campus de Lawrenceville, con apoyo en línea. Los grupos son pequeños.',
        },
        {
          question: '¿Me ayudan a encontrar trabajo?',
          answer:
            'Sí. Trabaja uno a uno con alguien en su currículum, en dónde mandar su solicitud y en las entrevistas, y le pasamos avisos de empleo y contactos con empleadores. Cuando empiece a trabajar le llamamos a los 30, 60 y 90 días.',
        },
        {
          question: '¿Pueden ayudar con el transporte, o con ropa para la entrevista?',
          answer:
            'Tal vez. Según lo que necesite, es posible que podamos ayudar con el transporte a la clase, ropa para la entrevista, conexión a internet en casa y el costo del examen o de la identificación. Eso lo vemos con usted en su plan, en la primera semana. No hay pagos ni estipendios por asistir.',
        },
        {
          question: '¿Tienen a alguien que hable español?',
          answer:
            'Sí. Tenemos personal que habla inglés y español. Llame al (609) 712-5499 y pregunte por alguien que hable español.',
        },
        {
          question: '¿Y si recibo beneficios pero no sé de qué tipo?',
          answer:
            'Llámenos al (609) 712-5499 y lo averiguamos con usted. Revisamos con la agencia de servicios sociales de su condado, para que usted no tenga que hacerlo.',
        },
      ],
    },

    contact: {
      eyebrow: 'Para empezar',
      heading: 'Hable con nosotros',
      intro:
        'Llámenos o escríbanos. Le ayudamos a ver si califica, y preguntar no cuesta nada.',
      callLabel: 'Teléfono',
      emailLabel: 'Correo',
      visitLabel: 'Dirección',
      sessionsLabel: 'Sesiones informativas',
      sessionsValue: 'Pronto compartiremos los detalles',
      callCta: `Llame al ${site.phone.display}`,
      emailCta: 'Escríbanos',
    },
  },

  /* ---------- Páginas de programa y 404 ---------- */
  programPage: {
    /**
     * {program} se reemplaza con el nombre CORTO del programa (shortName). El
     * nombre largo lleva el nombre oficial en ingles entre parentesis, que en
     * un <title> pasa de 60 caracteres y repite "Capacitacion".
     */
    titleTemplate: `Capacitación de {program} | ${site.name}`,
    breadcrumbHome: 'Inicio',
    breadcrumbPrograms: 'Programas',
    breadcrumbLabel: 'Ruta de navegación',
    factsHours: 'Horas',
    factsLength: 'Duración',
    factsCost: 'Costo',
    factsExamFee: 'Costo del examen',
    factsNextGroup: 'Próximo grupo',
    fundingHeading: 'Cómo pagarlo',
    fundingBody:
      'No damos ayuda económica propia. Sí aceptamos subvenciones de afuera, incluidas las del One-Stop Career Center y del Departamento de Trabajo de Nueva Jersey. Tráiganos lo que le dio su trabajador de caso (caseworker) y le mostramos cómo usarlo.',
    ctaLabel: 'Pida que le llamemos sobre este programa',
    callLabel: `Llame al ${site.phone.display}`,
    registryBefore: 'Nuestros certificados están en un registro público. ',
    registryLinkLabel: 'Verificado en Credential Finder',
    backLabel: 'Volver a todos los programas',
  },

  notFound: {
    title: `Página no encontrada | ${site.name}`,
    description: 'Esa página no existe. Así puede volver al resto del sitio.',
    heading: 'No encontramos esa página',
    body: 'Puede que el enlace sea viejo, o que la dirección tenga un error. Pruebe la página principal, o llámenos y le decimos por dónde ir.',
    homeCta: 'Ir a la página principal',
    callCta: `Llame al ${site.phone.display}`,
  },
};

/** Not used by es.ts itself; kept so the file reads as a pair with en.ts. */
export type { Dictionary };
