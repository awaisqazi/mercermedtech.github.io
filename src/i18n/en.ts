/**
 * ENGLISH WORDING FOR THE WHOLE SITE.
 *
 * Every sentence a visitor reads in English is in this file, except program
 * facts (programs.ts) and school facts (site.ts). Its Spanish twin is es.ts.
 *
 * RULE: edit the two files together. A change in one language only is an
 * unfinished change, and "npm run check:i18n" will say so.
 */
import { site, dlt } from '../data/site';

export const en = {
  /* ---------- Language switch and shared UI ---------- */
  ui: {
    languageLabel: 'Language',
    /** Wording of this language in its own language. */
    thisLanguage: 'English',
    otherLanguage: 'Español',
    switchAria: 'Ver esta página en español',
    menuLabel: 'Menu',
    primaryNavLabel: 'Primary',
    logoAlt: site.name,
    homeAria: `${site.name} home`,
    skipLink: 'Skip to main content',
    floatingCallLabel: 'Call us',
    callAria: `Call ${site.name}`,
    /**
     * NJDOL requires its funding sentence word for word in English. On Spanish
     * pages a Spanish rendering is printed first and the English sentence
     * follows, marked lang="en". In English this key IS that sentence.
     */
    fundingSentenceLocal: dlt.fundingSentence,
  },

  /* ---------- Header and footer ---------- */
  nav: {
    home: 'Home',
    about: 'About',
    med: 'Med',
    tech: 'Tech',
    enroll: 'Enroll',
    faculty: 'Faculty',
    requestInfo: 'Request info',
  },

  dltNav: {
    qualify: 'Who qualifies',
    learn: 'What you learn',
    enroll: 'How to enroll',
    partners: 'For caseworkers',
  },

  footer: {
    explore: 'Explore',
    contact: 'Contact',
    follow: 'Find us online',
    credentialFinder: 'See our listing on Credential Finder',
    brandLine:
      'Health care and computer skills training in Lawrenceville, NJ. Med and Tech. Two paths to a better job.',
    links: {
      home: 'Home',
      about: 'About',
      med: 'Med programs',
      tech: 'Tech programs',
      dlt: 'Digital Literacy Training',
      enroll: 'Enroll',
      faculty: 'Faculty',
      contact: 'Request info',
    },
    homeLink: 'Mercer Med Tech home',
    /** State licence plus the Eligible Training Provider List, in both footers. */
    licensingLine: site.licensingEtplLine,
  },

  /* ---------- Homepage ---------- */
  home: {
    seo: {
      // SEO limits, enforced by npm run check:seo: title <= 60, description <= 155.
      title: 'Mercer Med Tech | Health Care and Computer Training, NJ',
      description:
        'State-approved school in Lawrenceville, NJ. Train for health care work, or take Digital Literacy Training at no cost if you qualify. (609) 712-5499.',
      keywords:
        'mercer med tech, digital literacy training nj, free computer classes new jersey, ai literacy, medical assistant training lawrenceville nj, phlebotomy class nj, ekg technician, patient care technician, cna, certified medication aide, tanf snap job training',
      ogTitle: 'Health care and computer training in Lawrenceville, NJ',
      ogDescription:
        'One school, two paths to a better job. Health care certification programs, and Digital Literacy Training at no cost if you qualify.',
      twitterDescription:
        'Health care certification programs in Lawrenceville, NJ, and Digital Literacy Training at no cost if you qualify.',
      schemaDescription:
        "Mercer Med Tech is a state-approved private vocational school in Lawrenceville, NJ. The Med track is allied health certification: Medical Assistant, Phlebotomy, Patient Care Technician, EKG, Certified Nursing Assistant, and Certified Medication Aide. The Tech track is Digital Literacy Training, at no cost to eligible New Jersey residents. Mercer Med Tech is on New Jersey's Eligible Training Provider List (ETPL).",
      catalogName: 'Med and Tech Career Training Programs',
      dltCatalogDescription:
        'Computer skills and job search training, at no cost to eligible New Jersey residents. Covers computer and internet basics, Microsoft Office and Google Workspace, online safety, AI literacy, money management, and getting ready for work. Every participant starts with a skills check so the training fits what they already know.',
    },

    announce: {
      label: 'Announcement',
      message: 'Digital Literacy Training is enrolling soon. No cost if you qualify.',
      ctaLabel: 'See if you qualify',
    },

    hero: {
      headingBefore: 'One school. ',
      headingAccent: 'Two paths',
      headingAfter: ' to a better job.',
      lead: 'We train people in Lawrenceville for two kinds of work that central New Jersey is hiring for: hands-on care, and computer work. Pick a health care certification, or take Digital Literacy Training, which costs you nothing if you qualify.',
      trustLabel: 'What the school is',
      trust: [
        { icon: 'fas fa-landmark', label: 'State-approved' },
        { icon: 'fas fa-check-circle', label: 'Listed on Credential Finder' },
        { icon: 'fas fa-clipboard-check', label: "On New Jersey's Eligible Training Provider List" },
        { icon: 'fas fa-briefcase', label: 'Help finding work' },
      ],
      medPanel: {
        label: 'Med',
        heading: 'Health care certification',
        body: 'Get certified for work in clinics, hospitals, and care homes. Small classes, and instructors who have done the job.',
        chipsLabel: 'Med track programs',
        chips: ['Medical Assistant', 'Phlebotomy', 'Patient Care Technician', 'EKG'],
        ctaLabel: 'See the Med programs',
      },
      techPanel: {
        label: 'Tech',
        heading: 'Computer skills, and help finding work',
        body: 'Learn the computer skills employers expect, from the basics up, and get help finding a job when you are ready.',
        chipsLabel: 'What the Tech track covers',
        chips: [
          'Digital Literacy Training',
          'AI literacy',
          'Microsoft Office and Google Workspace',
          'Career services',
        ],
        ctaLabel: 'See the Tech track',
      },
      quietBefore: 'Not sure which one fits? ',
      quietLinkLabel: 'Ask us',
      quietAfter: ' and we will talk it through with you.',
    },

    enroll: {
      sectionTitle: 'Enroll at Mercer Med Tech',
      med: {
        badge: 'Enrolling year-round',
        titleAccent: 'Health care programs',
        titleRest: ', enrolling year-round',
        subtitle:
          'Get certified at our Lawrenceville campus. Small classes, instructors who have done the job, and hands-on practice, with an externship in the programs that include one.',
        programsLabel: 'Health care programs offered',
        formatLabel: 'Format',
        formatValue: 'In person, with some online support',
        locationLabel: 'Location',
        programsCta: 'See the programs',
        contactCta: 'Ask about dates and cost',
        scheduleLabel: 'When the next groups start',
      },
      tech: {
        badge: 'Enrolling soon · No cost if you qualify',
        titleAccent: 'Digital Literacy Training',
        titleRest: ', enrolling soon',
        subtitle:
          'We start with a short skills check so your training fits what you already know. From there you cover Microsoft Office and Google Workspace, online safety, AI, and money management, and you work toward an industry-recognized credential. Training is in person at our Lawrenceville campus, with online support, and someone here helps you look for work.',
        costLabel: 'Cost',
        costValue: 'No cost if you qualify',
        lengthLabel: 'Length',
        lengthValue: dlt.length,
        sessionsLabel: 'Information sessions',
        sessionsValue: 'Details will be shared soon',
        locationLabel: 'Location',
        qualifyLabel: 'Who qualifies:',
        qualifyText:
          'You live in New Jersey, you are 18 or older, you get TANF or SNAP, and you live in Hunterdon, Middlesex, Monmouth, Mercer, Ocean, Somerset, or Union county.',
        featuresLabel: 'What the training covers',
        features: [
          { icon: 'fas fa-robot', label: 'AI literacy' },
          { icon: 'fas fa-file-word', label: 'Microsoft Office and Google Workspace' },
          { icon: 'fas fa-shield-alt', label: 'Online safety' },
          { icon: 'fas fa-piggy-bank', label: 'Money management' },
          { icon: 'fas fa-comments', label: 'Career coaching' },
          { icon: 'fas fa-briefcase', label: 'Help finding work' },
        ],
        qualifyCta: 'See if you qualify',
        callCta: `Call ${site.phone.display}`,
      },
    },

    about: {
      heading: 'About Mercer Med Tech',
      imageAlt: 'A classroom at the Mercer Med Tech campus in Lawrenceville',
      paragraphs: [
        'Mercer Med Tech is a small private vocational school in Lawrenceville. The New Jersey Department of Labor and Workforce Development licenses us and approves what we teach. We started out training people for health care jobs, and we still do that, in small classes, on real equipment, with instructors who have done the work themselves.',
        'The name says the rest. Med is the health care side. Tech is the computer side, which now means Digital Literacy Training, run with the New Jersey Department of Labor and Workforce Development at no cost to people who qualify. Central New Jersey is hiring for both, so we teach both the same way: hands on, and close to what the job actually asks of you.',
      ],
      medCta: 'See the Med programs',
      dltCta: 'Read about Digital Literacy Training',
    },

    programs: {
      heading: 'Our programs',
      intro:
        'Two tracks under one school. Health care certification on the Med side, computer skills on the Tech side.',
      med: {
        tag: 'Med track',
        heading: 'Health care programs',
        intro: 'Certification programs with small classes and hands-on practice. Some include an externship.',
        detailsLabel: 'See the details',
        prevLabel: 'Previous program',
        nextLabel: 'Next program',
        swipeLabel: 'Swipe to see more',
        dotLabel: 'Go to program',
        trackLabel: 'Health care programs',
        notesHeading: 'Where these numbers come from',
        notes: [
          'Wages and job growth come from the U.S. Bureau of Labor Statistics Occupational Outlook Handbook, May 2024.',
          'EKG is a special case. The Bureau counts EKG technicians together with cardiovascular technologists, who earn more because most of them hold a two-year degree. The $42,000 to $54,000 range we show is for certificate holders like our graduates.',
        ],
      },
      tech: {
        tag: 'Tech track',
        heading: 'Computer skills training',
        intro:
          'Computer skills, AI, and help finding work, for people who want a job that uses a computer every day.',
        chips: [
          'AI literacy',
          'Microsoft Office and Google Workspace',
          'Online safety',
          'Money management',
          'Career coaching',
        ],
        modulesLabel: 'What you learn',
        modules: [
          { icon: 'fas fa-desktop', label: 'Computer basics' },
          { icon: 'fas fa-envelope', label: 'Internet, email, and online communication' },
          { icon: 'fas fa-file-word', label: 'Microsoft Office and Google Workspace' },
          { icon: 'fas fa-shield-alt', label: 'Online safety and cybersecurity basics' },
          { icon: 'fas fa-robot', label: 'AI literacy' },
          { icon: 'fas fa-piggy-bank', label: 'Money management' },
          { icon: 'fas fa-briefcase', label: 'Getting ready for work' },
        ],
        sessionsLine: `Enrolling soon. ${site.infoSessionsNote}`,
        readMoreCta: 'Read about Digital Literacy Training',
        callCta: `Call ${site.phone.display}`,
      },
    },

    tuition: {
      badge: 'What it costs',
      heading: 'What each program costs',
      intro:
        'Here is the price of every program, up front. Digital Literacy Training is grant funded, so if you qualify it costs you nothing. We do not give out financial aid ourselves, but we do take outside grants, including One-Stop Career Center and NJ Department of Labor funding.',
      caption: 'Tuition and program length for Mercer Med Tech programs',
      columns: {
        program: 'Program',
        hours: 'Hours',
        length: 'Length',
        cost: 'Cost',
        examFee: 'Exam fee',
      },
      note: 'Exam fees are on top of the price shown. Medical Assistant tuition includes your books and a $150 administrative fee, which is not refundable. Digital Literacy Training is grant funded, so if you qualify you pay nothing. The refund schedule is in the school catalog and in your Enrollment Agreement, and we will go through it with you before you sign.',
      contactCta: 'Ask about dates and cost',
      grantsCta: 'See grant funding',
    },

    why: {
      badge: 'Student support',
      heading: 'Why Mercer Med Tech',
      intro:
        'A state-approved private vocational school. Real instructors, small classes, and someone who picks up the phone.',
      cards: [
        {
          icon: 'fas fa-landmark',
          heading: 'Licensed by the state',
          body: "The New Jersey Department of Labor and Workforce Development licenses this school and approves what we teach. Mercer Med Tech is on New Jersey's Eligible Training Provider List (ETPL).",
        },
        {
          icon: 'fas fa-briefcase',
          heading: 'Help finding work',
          body: 'We work on your resume with you, sit with you while you apply online, and practice interviews until they feel normal. We are connected to the New Jersey One-Stop system for job leads.',
        },
        {
          icon: 'fas fa-comments',
          heading: 'Someone to talk it through with',
          body: 'Sit down with us and work out which track fits you, what the certificate takes, and what comes after it.',
        },
        {
          icon: 'fas fa-language',
          heading: 'We speak Spanish',
          body: 'Staff who speak Spanish can help you sign up and can stay with you through the program.',
        },
        {
          icon: 'fas fa-clock',
          heading: 'Class times',
          body: 'Class times depend on the program. Call and we will tell you the days and hours for the one you are looking at.',
        },
        {
          icon: 'fas fa-users',
          heading: 'Small classes',
          body: 'You get time with the instructor, and you practice on the equipment and on the computer, not just out of a book.',
        },
        {
          icon: 'fas fa-hand-holding-usd',
          heading: 'We take grant funding',
          body: 'We do not give out financial aid ourselves. We do take outside grants, including One-Stop Career Center and NJ Department of Labor funding. Bring us what your caseworker gave you.',
        },
        {
          icon: 'fas fa-wheelchair',
          heading: 'You can get in and around',
          body: 'Accessible parking and a ramp at the door, accessible restrooms, a break room, and air conditioning.',
        },
      ],
      admissions: {
        heading: 'What you need to enroll in a Med program',
        intro: 'Four things. That is the whole list.',
        items: [
          { icon: 'fas fa-id-card', title: '17 or older', body: 'By your first day of class.' },
          {
            icon: 'fas fa-graduation-cap',
            title: 'High school diploma or GED',
            body: 'If you do not have one, ask us about the Ability to Benefit test.',
          },
          {
            icon: 'fas fa-file-signature',
            title: 'Sign up in person',
            body: 'Bring a photo ID, proof of your education, and your first payment.',
          },
          {
            icon: 'fas fa-clock',
            title: 'Sign up early',
            body: 'At least 5 business days before class starts, or 20 days if you are using grant funding.',
          },
        ],
        ctaLabel: 'Ask us to call you',
        metaBefore: 'Or call ',
        metaAfter: ' and ask for admissions. Digital Literacy Training has different requirements.',
        metaLinkLabel: 'See if you qualify',
      },
    },

    grants: {
      med: {
        imageAlt: 'A school advisor reviewing tuition and grant paperwork with an adult student',
        heading: 'Paying for a Med program',
        body: "We do not give out grants, scholarships, or financial aid ourselves. We do take outside grants, including One-Stop Career Center grants and NJ Department of Labor funding. Bring us what your caseworker gave you and we will show you how to use it. Mercer Med Tech is on New Jersey's Eligible Training Provider List (ETPL), so ask your caseworker which programs your funding covers.",
        bullets: [
          { icon: 'fas fa-award', label: 'We take One-Stop Career Center and NJ Department of Labor grants' },
          { icon: 'fas fa-comments-dollar', label: 'We will help you apply for them' },
        ],
        loanHeading: 'If you take out a loan',
        loanBody:
          'If you take out a school-assisted loan, you have to pay it back in full. That is true whether or not you finish the program. If you withdraw, tell your lender yourself. We will send any refund you are owed to the lender, following our refund policy, but anything still owed on the note is yours to pay.',
        loanInvite: 'Worried about the cost? Call us. We will go through it with you before you sign anything.',
        ctaLabel: 'Ask about paying for it',
      },
      tech: {
        heading: 'Digital Literacy Training is grant funded',
        body: 'If you qualify, it costs you nothing. No tuition, and no fee for the exam. We confirm your eligibility with your county social services agency, and we will help you check whether you qualify.',
        ctaLabel: 'See if you qualify',
      },
    },

    faculty: {
      heading: 'The people you will deal with',
      intro: 'A small school. You will get to know the person who answers the phone.',
      people: [
        {
          name: 'Shazia Qazi',
          role: 'Program Director & Director of Education',
          bio: 'Shazia runs the school’s programs and day-to-day operations. She came up through medical office management, billing, and coding. She is usually the one who walks you through signing up.',
          icon: 'fas fa-user-md',
        },
      ],
    },

    organizations: {
      heading: 'Who we work with',
      intro: 'These are the agencies that license us, register our credentials, and run our exams.',
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
      eyebrow: 'Request a call',
      heading: 'Have us call you back',
      intro:
        'Fill this in and we will call you back with dates, what it costs, and what you need to sign up. It costs nothing to ask, and you are not signing up for anything.',
      callLabel: 'Call',
      emailLabel: 'Email',
      visitLabel: 'Visit',
      nameLabel: 'Your name',
      namePlaceholder: 'First and last name',
      phoneLabel: 'Phone number',
      phonePlaceholder: '(609) 555 1234',
      emailFieldLabel: 'Email address',
      emailPlaceholder: 'you@example.com',
      programLabel: 'Which program?',
      programPlaceholder: 'Pick one',
      bestTimeLabel: 'When is a good time to call?',
      bestTimePlaceholder: 'Anytime works',
      bestTimeOptions: [
        'Morning (9:00 AM - 12:00 PM)',
        'Afternoon (12:00 PM - 5:00 PM)',
        'Evening (5:00 PM - 8:00 PM)',
        'Anytime',
      ],
      notSureOption: 'Not sure yet',
      messageLabel: 'Anything else?',
      messagePlaceholder: 'For example: what does it cost, when is the next class, is there parking.',
      optional: 'optional',
      consent: 'Yes, you can call or email me about this. We do not share your information with anyone.',
      submit: 'Request a call',
      sending: 'Sending',
      successTitle: 'Got it. We have your message.',
      successBody: `Someone from the school will call you back. If you would rather not wait, call us at ${site.phone.display}.`,
      errorTitle: 'We could not send that.',
      errorBody: `Sorry, something went wrong on our end. Please call us at ${site.phone.display} or email ${site.email} and we will pick it up from there.`,
      iframeTitle: 'Form submission target',
    },

    modals: {
      closeLabel: 'Close',
      closeButtonLabel: 'Close',
      pageLinkLabel: 'Open the full page',
    },

    waitlistCta: 'Put me on the list',
  },

  /* ---------- Digital Literacy Training landing page ---------- */
  dlt: {
    seo: {
      title: 'Digital Literacy Training | Mercer Med Tech',
      description:
        'Free computer, AI, and job search classes in Lawrenceville, NJ, for New Jersey adults on TANF or SNAP. About 5 to 6 weeks. Call (609) 712-5499.',
      keywords:
        'digital literacy training New Jersey, no cost computer training, AI literacy, TANF SNAP training NJ, WorkFirst New Jersey, Lawrenceville NJ, career readiness, Mercer Med Tech',
      ogTitle: 'Free computer and AI classes, no cost if you qualify',
      ogDescription:
        'Learn computers, AI, and money skills in about 5 to 6 weeks in Lawrenceville, NJ. Enrolling soon. Call (609) 712-5499.',
      twitterDescription:
        'Computer and job search classes in Lawrenceville, NJ, at no cost for New Jersey adults on TANF or SNAP. Enrolling soon.',
      schemaDescription:
        'Computer skills and job search training for eligible New Jersey residents, at no cost. Every participant starts with a skills check, so the training fits what they already know. Covers computer basics, internet and email, Microsoft Office and Google Workspace, online safety and cybersecurity basics, AI literacy, money management, and getting ready for work. Participants work toward an industry-recognized credential, including an AI literacy micro-credential, and career services continue with check-ins at 30, 60, and 90 days after starting a job.',
    },

    hero: {
      eyebrowTrailing: 'Tech track',
      headingBefore: 'Learn computer skills for work. ',
      headingAccent: 'No cost if you qualify.',
      lead: 'Digital Literacy Training at Mercer Med Tech prepares you for work that uses a computer every day. We start with a short skills check so your training fits what you already know. From there you cover Microsoft Office and Google Workspace, staying safe online, AI, and money management. You leave with a credential you can show an employer, and with someone here helping you look for work. It is grant funded, so if you qualify it costs you nothing.',
      chips: [
        { icon: 'fas fa-bullhorn', label: 'Enrolling soon' },
        { icon: 'fas fa-tag', label: 'No cost if you qualify' },
        { icon: 'fas fa-hourglass-half', label: dlt.length },
        { icon: 'fas fa-map-marker-alt', label: `${site.address.city}, ${site.address.region}` },
        { icon: 'fas fa-language', label: 'English and Spanish' },
      ],
      qualifyCta: 'See if you qualify',
      callCta: `Call ${site.phone.display}`,
      artLabel: 'A laptop, a certificate, and a rising chart',
    },

    strip: {
      heading: 'Information sessions',
      note: site.infoSessionsNote,
      ctaLabel: 'Ask us to contact you when enrollment opens',
      callLabel: 'Call',
      whereLabel: 'Where',
    },

    qualify: {
      eyebrow: 'Who qualifies',
      heading: 'Four things to check',
      intro: 'If all four describe you, you are very likely eligible.',
      checks: [
        {
          title: 'You live in New Jersey and are 18 or older',
          body: 'Age 18 or older on your first day of training.',
        },
        { title: 'You currently receive TANF or SNAP', body: 'Benefits through WorkFirst New Jersey.' },
        { title: 'You live in one of seven counties', body: 'See the list below.' },
        {
          title: 'You are ready to train and look for work',
          body: 'You can come to class and work with us on the job search.',
        },
      ],
      countiesHeading: 'Counties served',
      note: 'We confirm your eligibility with your county social services agency. You do not have to do that part yourself.',
      calloutStrong: 'Not sure? Call us.',
      calloutBefore: ' We will help you check. Call ',
      calloutAfter: ' and we will go through it with you.',
    },

    learn: {
      eyebrow: 'What you learn',
      heading: 'Seven skill areas, taught in small groups',
      intro:
        'Every one of them is hands-on. You are on a computer, not reading about one. Before you start, we check what you already know, so your training starts at the right level for you.',
      cards: [
        {
          icon: 'fas fa-desktop',
          heading: 'Computer basics',
          body: 'The mouse and the keyboard, files and folders, and changing the settings on your machine.',
        },
        {
          icon: 'fas fa-envelope',
          heading: 'Internet, email, and online communication',
          body: 'Searching, browsing safely, writing professional email, and meeting online.',
        },
        {
          icon: 'fas fa-file-alt',
          heading: 'Microsoft Office and Google Workspace',
          body: 'Documents, spreadsheets, and slides, in both of the tool sets employers use.',
        },
        {
          icon: 'fas fa-shield-alt',
          heading: 'Online safety and cybersecurity basics',
          body: 'Passwords, phishing, scams, and protecting your accounts and personal information.',
        },
        {
          icon: 'fas fa-robot',
          heading: 'AI literacy',
          body: 'How to use AI tools at work, what they are good at, and where they get things wrong.',
        },
        {
          icon: 'fas fa-piggy-bank',
          heading: 'Money management',
          body: 'Banking on your phone, keeping a budget, and spotting a scam before it costs you.',
        },
        {
          icon: 'fas fa-briefcase',
          heading: 'Getting ready for work',
          body: 'Your resume, applying online, practicing interviews, and a job search you can keep going on your own.',
        },
      ],
    },

    outcomes: {
      eyebrow: 'What you leave with',
      heading: 'Proof of your skills, and a plan',
      cards: [
        {
          icon: 'fas fa-certificate',
          heading: 'A credential',
          body: 'You work toward an industry-recognized credential, including an AI literacy micro-credential.',
        },
        {
          icon: 'fas fa-file-alt',
          heading: 'A finished resume',
          body: 'Your resume, ready to send, and a professional email address to send it from.',
        },
        {
          icon: 'fas fa-comments',
          heading: 'Interview practice',
          body: 'You practice with us first, so the first real interview is not your first one.',
        },
        {
          icon: 'fas fa-search',
          heading: 'A job search plan',
          body: 'Where to look, what to apply for, and how to keep the search going.',
        },
        {
          icon: 'fas fa-handshake',
          heading: 'Someone in your corner after',
          body: 'You keep working with us one to one, we connect you with employers, and after you start a job we check in at 30, 60, and 90 days.',
        },
      ],
    },

    support: {
      eyebrow: 'Support while you train',
      heading: 'You are not doing this alone',
      items: [
        {
          icon: 'fas fa-user-edit',
          body: 'In your first week, you and your advisor write a plan together. It says what you are aiming for and what you need to get there.',
        },
        { icon: 'fas fa-users', body: 'Small groups, so you get time with the instructor.' },
        { icon: 'fas fa-language', body: 'Staff who speak English and Spanish.' },
      ],
      panelHeading: 'Help with the things that get in the way',
      panelIntro: 'Depending on what you need, we may be able to help with:',
      panelItems: [
        { icon: 'fas fa-laptop', body: 'Getting online at home.' },
        { icon: 'fas fa-bus', body: 'Getting to class.' },
        { icon: 'fas fa-tshirt', body: 'Clothes for an interview.' },
        { icon: 'fas fa-id-card', body: 'Exam and ID fees.' },
      ],
      panelNote:
        'We work out what you need in your plan, in your first week. There are no stipends or payments for attending.',
    },

    enroll: {
      eyebrow: 'How to enroll',
      heading: 'Four steps, in order',
      intro: 'Digital Literacy Training is enrolling soon. Call and we will tell you when the next group begins.',
      steps: [
        {
          title: 'Call us or send a message',
          body: `Call <a href="${site.phone.href}">${site.phone.display}</a> or email <a href="mailto:${site.email}">${site.email}</a>. ${site.infoSessionsNote}`,
        },
        {
          title: 'We confirm your eligibility',
          body: 'We check with your county social services agency. You do not need a referral to start.',
        },
        {
          title: 'We check your skills and write your plan',
          body: 'A short skills check tells us where to start you. Then, in your first week, we set your goals and work out what support you need.',
        },
        {
          title: 'You start training with your group',
          body: 'In person at the Lawrenceville campus, with online support, for about 5 to 6 weeks.',
        },
      ],
    },

    partners: {
      eyebrow: 'For referral partners',
      heading: 'County agencies, One-Stop Career Centers, and community organizations',
      intro: 'We work with the people who already know your clients.',
      whoHeading: 'Who to refer',
      whoBody: `New Jersey residents 18 or older who currently receive TANF or SNAP and live in ${dlt.countiesSentence}. We give every participant a skills check and place them at the right level, so you can refer someone at any starting point. ${site.etplLine}`,
      howHeading: 'How to refer',
      howItems: [
        { icon: 'fas fa-phone-alt', body: `Call <a href="${site.phone.href}">${site.phone.display}</a>.` },
        { icon: 'fas fa-envelope', body: `Email <a href="mailto:${site.email}">${site.email}</a>.` },
        {
          icon: 'fas fa-calendar-check',
          body: `${site.infoSessionsNote} We do not require a referral form. If your county has its own intake steps, tell us and we will work to them.`,
        },
      ],
      reportHeading: 'What we report back',
      reportBody:
        "With the participant's consent, we send your agency regular updates: whether they enrolled, whether they are attending, whether they earned the credential, and whether they found work.",
      contactHeading: 'Contact',
      phoneLabel: 'Phone',
      campusLabel: 'Campus',
    },

    faq: {
      eyebrow: 'Questions',
      heading: 'Questions people ask us',
      items: [
        {
          question: 'Does it cost anything?',
          answer:
            'No. It is grant funded, so if you qualify it costs you nothing. To be straight with you: there are no stipends or payments for attending either.',
        },
        {
          question: 'When can I start?',
          answer:
            'Digital Literacy Training is enrolling soon. Call us at (609) 712-5499 and we will tell you when the next group starts, or ask us to contact you when enrollment opens.',
        },
        {
          question: 'Who is eligible?',
          answer:
            'You need to live in New Jersey, be 18 or older, currently get TANF or SNAP through WorkFirst New Jersey, and live in Hunterdon, Middlesex, Monmouth, Mercer, Ocean, Somerset, or Union county. We confirm it with your county social services agency.',
        },
        {
          question: 'Do I need a referral?',
          answer:
            'No. You do not need a caseworker to send you. Call us at (609) 712-5499 and we will start with you directly.',
        },
        {
          question: 'When are the information sessions?',
          answer:
            'Details on upcoming information sessions will be shared soon. Call us and we will tell you as soon as the next one is set.',
        },
        {
          question: 'Do I need my own computer?',
          answer:
            'No. You use our computers here. If getting online at home is a problem, tell us, and we will see what we can do as part of your plan.',
        },
        {
          question: 'How long is it, and what are the hours?',
          answer: 'About 5 to 6 weeks. Call us and we will tell you the days and hours for the next group.',
        },
        {
          question: 'Is it in person?',
          answer: 'Yes. Training is in person at our Lawrenceville campus, with online support. Groups are small.',
        },
        {
          question: 'Will you help me find a job?',
          answer:
            'Yes. You work with someone one to one on your resume, on where to apply, and on interviews, and we pass on job leads and employer contacts. After you start a job we check in with you at 30, 60, and 90 days.',
        },
        {
          question: 'Can you help with getting to class, or clothes for an interview?',
          answer:
            'Maybe. Depending on what you need, we may be able to help with getting to class, clothes for an interview, getting online at home, and exam or ID fees. We work that out with you in your plan in your first week. There are no stipends or payments for attending.',
        },
        {
          question: 'Do you have anyone who speaks Spanish?',
          answer:
            'Yes. We have staff who speak English and Spanish. Call (609) 712-5499 and ask for someone who speaks Spanish.',
        },
        {
          question: 'What if I receive benefits but I am not sure which kind?',
          answer:
            'Call us at (609) 712-5499 and we will help you work it out. We check with your county social services agency, so you do not have to.',
        },
      ],
    },

    contact: {
      eyebrow: 'Get started',
      heading: 'Talk to us',
      intro: 'Call or email us. We will help you check whether you qualify, and it costs nothing to ask.',
      callLabel: 'Call',
      emailLabel: 'Email',
      visitLabel: 'Visit',
      sessionsLabel: 'Information sessions',
      sessionsValue: 'Details will be shared soon',
      callCta: `Call ${site.phone.display}`,
      emailCta: 'Email us',
    },
  },

  /* ---------- Program pages and 404 ---------- */
  programPage: {
    /**
     * {program} is replaced with the program's SHORT name (shortName). The full
     * name carries the official English name in brackets on Spanish pages, which
     * pushes every <title> past 60 characters and reads "Capacitacion de
     * Capacitacion en ...". Keep this pattern under 60 characters with the
     * longest short name in either language.
     */
    titleTemplate: `{program} Training | ${site.name}`,
    breadcrumbHome: 'Home',
    breadcrumbPrograms: 'Programs',
    breadcrumbLabel: 'Breadcrumb',
    factsHours: 'Hours',
    factsLength: 'Length',
    factsCost: 'Cost',
    factsExamFee: 'Exam fee',
    factsNextGroup: 'Next group',
    fundingHeading: 'Paying for it',
    fundingBody:
      'We do not give out financial aid ourselves. We do take outside grants, including One-Stop Career Center and NJ Department of Labor funding. Bring us what your caseworker gave you and we will show you how to use it.',
    ctaLabel: 'Ask us to call you about this program',
    callLabel: `Call ${site.phone.display}`,
    registryBefore: 'Our credentials are listed publicly. ',
    registryLinkLabel: 'Verified on Credential Finder',
    backLabel: 'Back to all programs',
  },

  notFound: {
    title: `Page not found | ${site.name}`,
    description: 'That page does not exist. Here is how to get back to the rest of the site.',
    heading: 'We could not find that page',
    body: 'The link may be old, or the address may have a typo in it. Try the homepage, or call us and we will point you the right way.',
    homeCta: 'Go to the homepage',
    callCta: `Call ${site.phone.display}`,
  },
};

export type Dictionary = typeof en;
