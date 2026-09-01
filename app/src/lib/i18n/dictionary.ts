import type { Locale } from './locales';

/**
 * All translatable UI chrome, keyed by locale. This does not cover the
 * model's own output (it already answers in the user's language per
 * `SYSTEM_PROMPT`) or the markdown content under `content/playbooks` and
 * `content/guides`, which stays English — see `contentEnglishNote` for the
 * note shown next to it in non-English locales.
 */
export interface Suggestion {
  title: string;
  prompt: string;
}

export interface Dictionary {
  appName: string;
  tagline: string;
  nav: {
    chat: string;
    deliverables: string;
    playbooks: string;
    guides: string;
    about: string;
  };
  localeSwitcher: {
    label: string;
  };
  coach: {
    label: string;
    tooltip: string;
  };
  composer: {
    placeholder: string;
    ariaLabel: string;
    send: string;
    stop: string;
  };
  disclaimer: string;
  /** Shown only on the public hosted demo — see `HostedModeNotice`. */
  hostedNotice: {
    label: string;
    body: string;
  };
  errorFallback: string;
  emptyState: {
    heading: string;
    body: string;
    /** The corpus-facts strip: source count, passage count, edition years. */
    factsStrip: [string, string, string];
    /** Three terse lines on what HAI does. */
    whatHaiDoes: [string, string, string];
    /** The honest-limits line shown under the facts strip. */
    limitsLine: string;
    suggestions: [Suggestion, Suggestion, Suggestion, Suggestion];
  };
  safetyNotice: {
    title: string;
    onePattern: string;
    nPatterns: (count: number) => string;
    screenedSuffix: string;
    principlesEngaged: string;
    readLink: string;
  };
  citations: {
    sources: string;
  };
  sourcePanel: {
    closePanel: string;
    close: string;
    openFullText: string;
    verifyText: string;
  };
  toolActivity: {
    running: Record<'search_standards' | 'crisis_updates' | 'humanitarian_data', string>;
    done: Record<'search_standards' | 'crisis_updates' | 'humanitarian_data', string>;
    failed: string;
  };
  /** The pending state shown between submit and the first visible token — see `PendingStatus`. */
  pending: {
    /** Shown from submit until the model's first visible action (a tool call or text). */
    contacting: string;
    /** Shown once retrieval has finished but no answer text has started yet. */
    writing: string;
    /** A subtle elapsed-time suffix, shown only once a wait passes ~3s. */
    elapsed: (seconds: number) => string;
  };
  /**
   * The deliverables surface: the template picker, the run view, and the trace
   * panel. `steps`, `verdicts`, and `templates` are keyed by values the engine
   * emits (`StepKind`, `Verdict`, workflow id) rather than by display strings,
   * so a locale cannot drift out of sync with the events it is labelling.
   *
   * The template names duplicate the English ones in `lib/agent/workflows/*` on
   * purpose: those are the document's own title, which stays in the language the
   * document is written in, while these are interface chrome and follow the
   * interface locale.
   */
  deliverables: {
    title: string;
    description: string;
    templateHeading: string;
    templates: Record<
      'situation-brief' | 'donor-report-section',
      { name: string; description: string }
    >;
    subjectLabelCountry: string;
    subjectLabelTopic: string;
    subjectPlaceholderCountry: string;
    subjectPlaceholderTopic: string;
    generate: string;
    generating: string;
    stop: string;
    reset: string;
    documentHeading: string;
    documentEmpty: string;
    copy: string;
    copied: string;
    download: string;
    /** Shown above a document whose run was cut short. */
    partialNotice: string;
    /** Shown above a document carrying unverified claims. */
    flaggedNotice: (count: number) => string;
    traceHeading: string;
    traceExplainer: string;
    traceEmpty: string;
    planHeading: string;
    steps: Record<'plan' | 'gather' | 'draft' | 'verify', string>;
    verdicts: Record<'supported' | 'unsupported' | 'unverifiable', string>;
    done: string;
    doneWithFlags: (count: number) => string;
    hasFlags: string;
    /** The chat's per-message disclosure, which reuses the trace rendering. */
    showWorking: string;
    hideWorking: string;
  };
  contentEnglishNote: string;
  playbooksPage: {
    title: string;
    description: string;
  };
  playbookDetail: {
    backLink: string;
    examplePromptsHeading: string;
    whyItWorks: string;
    tryInChat: string;
  };
  guidesPage: {
    title: string;
    description: string;
  };
  guideDetail: {
    backLink: string;
  };
  footer: {
    sourcesHeading: string;
    dataHeading: string;
    docsHeading: string;
    runsOnOpenModels: string;
    sphereLabel: string;
    chsLabel: string;
    iascLabel: string;
    hdxLabel: string;
    ifrcLabel: string;
  };
  about: {
    title: string;
    intro: string;
    grounded: { heading: string; body: string };
    safety: { heading: string; body: string };
    evals: { heading: string; body: string };
    limits: { heading: string; body: string };
  };
}

const en: Dictionary = {
  appName: 'HAI',
  tagline: 'Humanitarian operations assistant',
  nav: {
    chat: 'Chat',
    deliverables: 'Deliverables',
    playbooks: 'Playbooks',
    guides: 'Guides',
    about: 'About',
  },
  localeSwitcher: {
    label: 'Language',
  },
  coach: {
    label: 'Coach mode',
    tooltip:
      'Coach mode: before answering, HAI briefly points out one strength and one improvement to your prompt, then answers the improved version.',
  },
  composer: {
    placeholder: 'Ask about a standard, an indicator, or a current crisis…',
    ariaLabel: 'Message HAI',
    send: 'Send',
    stop: 'Stop',
  },
  disclaimer:
    'HAI provides guidance grounded in humanitarian standards. It does not replace professional judgment.',
  hostedNotice: {
    label: 'Hosted demo.',
    body: 'Messages are sent to a third-party model provider. Do not enter personal data about affected people. Run HAI locally to keep everything on your own machine.',
  },
  errorFallback: 'The assistant could not complete that request. Try again.',
  emptyState: {
    heading: 'Humanitarian standards, grounded and cited.',
    body: 'HAI answers from the Sphere Handbook, the Core Humanitarian Standard, and IASC guidance, and pulls live figures for active crises. It cites what it retrieves so you can check it against the handbook.',
    factsStrip: ['5 authoritative sources', '1,631 cited passages', 'Sphere 2018 · CHS 2024 · 3 IASC guidances'],
    whatHaiDoes: [
      'Grounded answers, every claim traced to a cited passage.',
      'Live crisis data from HDX HAPI and IFRC GO, not memorized figures.',
      'Role playbooks for six field functions, with prompts you can try.',
    ],
    limitsLine:
      'Not a substitute for professional judgment. Never enter identifiable data about affected people.',
    suggestions: [
      {
        title: 'Sphere minimum standards',
        prompt: 'What are the Sphere minimum standards for water supply per person per day?',
      },
      {
        title: 'Live situation reports',
        prompt: 'What are the latest situation reports for Sudan?',
      },
      {
        title: 'Data responsibility',
        prompt: 'How should we handle beneficiary data collected at intake?',
      },
      {
        title: 'Accountability to affected people',
        prompt: 'What are the CHS commitments on accountability to affected people?',
      },
    ],
  },
  safetyNotice: {
    title: 'Data responsibility — message not processed',
    onePattern: 'One pattern was detected',
    nPatterns: (count) => `${count} patterns were detected`,
    screenedSuffix:
      'and screened out before the model saw the message. Nothing was logged or stored.',
    principlesEngaged: 'IASC principles engaged:',
    readLink: 'Read: Responsible Use of AI in Humanitarian Work',
  },
  citations: {
    sources: 'Sources',
  },
  sourcePanel: {
    closePanel: 'Close source panel',
    close: 'Close',
    openFullText: 'Open the full text at the publisher',
    verifyText: 'Verify against the published handbook before acting on this passage.',
  },
  toolActivity: {
    running: {
      search_standards: 'Searching humanitarian standards',
      crisis_updates: 'Fetching situation reports',
      humanitarian_data: 'Retrieving country indicators',
    },
    done: {
      search_standards: 'Searched humanitarian standards',
      crisis_updates: 'Fetched situation reports',
      humanitarian_data: 'Retrieved country indicators',
    },
    failed: 'Live source unavailable',
  },
  pending: {
    contacting: 'Contacting model…',
    writing: 'Writing answer…',
    elapsed: (seconds) => `${seconds}s`,
  },
  deliverables: {
    title: 'Deliverables',
    description:
      'Generate a situation brief or a donor report section, grounded in retrieved sources — with every step of the working shown beside it.',
    templateHeading: 'Choose a template',
    templates: {
      'situation-brief': {
        name: 'Situation brief',
        description:
          'Hazards, needs and figures, funding, and the standards that apply — for one country.',
      },
      'donor-report-section': {
        name: 'Donor report section',
        description:
          'Context, needs and gaps, and the ask. The achievements narrative stays a template for your own monitoring data.',
      },
    },
    subjectLabelCountry: 'Country',
    subjectLabelTopic: 'Programme or topic',
    subjectPlaceholderCountry: 'e.g. Sudan',
    subjectPlaceholderTopic: 'e.g. WASH programme, northern Nigeria',
    generate: 'Generate',
    generating: 'Generating',
    stop: 'Stop',
    reset: 'Start over',
    documentHeading: 'Document',
    documentEmpty: 'The document assembles here, section by section.',
    copy: 'Copy',
    copied: 'Copied',
    download: 'Download .md',
    partialNotice:
      'This run did not finish. What is below is only what was completed — treat it as partial.',
    flaggedNotice: (count) =>
      count === 1
        ? '1 claim could not be matched to retrieved evidence and is marked in place. Verify it before using this document.'
        : `${count} claims could not be matched to retrieved evidence and are marked in place. Verify them before using this document.`,
    traceHeading: 'Working',
    traceExplainer:
      'Every source consulted and every claim checked, in the order it happened. Nothing in the document comes from anywhere else.',
    traceEmpty: 'Waiting for the first step.',
    planHeading: 'Plan',
    steps: { plan: 'Plan', gather: 'Gather', draft: 'Draft', verify: 'Check' },
    verdicts: { supported: 'Supported', unsupported: 'Unsupported', unverifiable: 'Unverified' },
    done: 'Run complete',
    doneWithFlags: (count) =>
      count === 1 ? 'Run complete — 1 claim flagged' : `Run complete — ${count} claims flagged`,
    hasFlags: 'Contains flagged claims',
    showWorking: 'Show working',
    hideWorking: 'Hide working',
  },
  contentEnglishNote: 'This content is available in English only.',
  playbooksPage: {
    title: 'Playbooks',
    description:
      "Role-specific guidance on where HAI genuinely helps, where it shouldn't be used, and example prompts you can try — each grounded in why the prompt works, not just what to paste.",
  },
  playbookDetail: {
    backLink: 'All playbooks',
    examplePromptsHeading: 'Example prompts',
    whyItWorks: 'Why it works:',
    tryInChat: 'Try in chat',
  },
  guidesPage: {
    title: 'Guides',
    description:
      'General-purpose guidance that applies across roles: how to prompt well, how to use AI responsibly with humanitarian data, and how to build adoption on your team.',
  },
  guideDetail: {
    backLink: 'All guides',
  },
  footer: {
    sourcesHeading: 'Sources',
    dataHeading: 'Live data',
    docsHeading: 'Learn more',
    runsOnOpenModels: 'Runs on open models — local by default, no cloud dependency required.',
    sphereLabel: 'Sphere Handbook (2018)',
    chsLabel: 'Core Humanitarian Standard (2024)',
    iascLabel: 'IASC guidance — data responsibility, protection, disability inclusion',
    hdxLabel: 'HDX HAPI — population, food security, funding',
    ifrcLabel: 'IFRC GO — crisis events',
  },
  about: {
    title: 'About HAI',
    intro: 'How HAI is built to be trusted with humanitarian work.',
    grounded: {
      heading: 'How answers are grounded',
      body: 'Every question runs through three steps: search, cite, verify. The assistant retrieves passages from the standards corpus, cites the source, section, and page, and says so when the corpus has nothing to give it — rather than guessing.',
    },
    safety: {
      heading: 'The safety layer',
      body: 'Every message is screened for identifiable data about affected people before it reaches the model. A match is refused, named against the specific IASC principle it engages, and offered a safe rephrasing — not a bare refusal.',
    },
    evals: {
      heading: 'How it is evaluated',
      body: 'A held-out set of scenarios is graded by a judge model from a different family than the one being tested, against explicit expected facts. Failure rates are published, not engineered away.',
    },
    limits: {
      heading: 'What HAI is not',
      body: "Not a substitute for professional judgment, and not a place for identifiable data about affected people. HAI names its sources so you can check them — it doesn't replace the handbook.",
    },
  },
};

const fr: Dictionary = {
  appName: 'HAI',
  tagline: 'Assistant pour les opérations humanitaires',
  nav: {
    chat: 'Discussion',
    deliverables: 'Livrables',
    playbooks: 'Fiches pratiques',
    guides: 'Guides',
    about: 'À propos',
  },
  localeSwitcher: {
    label: 'Langue',
  },
  coach: {
    label: 'Mode coaching',
    tooltip:
      "Mode coaching : avant de répondre, HAI relève brièvement un point fort et une amélioration possible de votre question, puis répond à la version améliorée.",
  },
  composer: {
    placeholder: "Posez une question sur une norme, un indicateur ou une crise en cours…",
    ariaLabel: 'Message à HAI',
    send: 'Envoyer',
    stop: 'Arrêter',
  },
  disclaimer:
    "HAI fournit des orientations fondées sur les normes humanitaires. Il ne remplace pas le jugement professionnel.",
  hostedNotice: {
    label: 'Démonstration hébergée.',
    body: "Les messages sont transmis à un fournisseur de modèle tiers. N'y saisissez aucune donnée personnelle concernant les personnes affectées. Installez HAI en local pour que tout reste sur votre machine.",
  },
  errorFallback: "L'assistant n'a pas pu traiter cette demande. Veuillez réessayer.",
  emptyState: {
    heading: 'Des normes humanitaires, sourcées et citées.',
    body: "HAI répond à partir du Manuel Sphère, de la Norme humanitaire fondamentale et des orientations de l'IASC, et récupère des chiffres actualisés pour les crises en cours. Il cite ses sources afin que vous puissiez les vérifier dans le manuel.",
    factsStrip: [
      "5 sources faisant autorité",
      '1 631 passages cités',
      "Sphère 2018 · CHS 2024 · 3 orientations de l'IASC",
    ],
    whatHaiDoes: [
      'Des réponses sourcées, chaque affirmation reliée à un passage cité.',
      'Des données de crise en direct issues de HDX HAPI et IFRC GO, jamais mémorisées.',
      'Des fiches pratiques par rôle pour six fonctions de terrain, avec des exemples à essayer.',
    ],
    limitsLine:
      "Ne remplace pas le jugement professionnel. N'y saisissez jamais de données identifiables sur les personnes affectées.",
    suggestions: [
      {
        title: 'Normes minimales Sphère',
        prompt:
          "Quelles sont les normes minimales Sphère pour l'approvisionnement en eau par personne et par jour ?",
      },
      {
        title: 'Rapports de situation en direct',
        prompt: 'Quels sont les derniers rapports de situation pour le Soudan ?',
      },
      {
        title: 'Responsabilité des données',
        prompt:
          "Comment devrions-nous traiter les données des bénéficiaires collectées à l'enregistrement ?",
      },
      {
        title: 'Redevabilité envers les populations affectées',
        prompt:
          'Quels sont les engagements de la Norme humanitaire fondamentale en matière de redevabilité envers les populations affectées ?',
      },
    ],
  },
  safetyNotice: {
    title: 'Responsabilité des données — message non traité',
    onePattern: 'Un motif a été détecté',
    nPatterns: (count) => `${count} motifs ont été détectés`,
    screenedSuffix:
      "et filtrés avant que le modèle ne voie le message. Rien n'a été enregistré ni stocké.",
    principlesEngaged: "Principes de l'IASC concernés :",
    readLink: "Lire : Utilisation responsable de l'IA dans le travail humanitaire",
  },
  citations: {
    sources: 'Sources',
  },
  sourcePanel: {
    closePanel: 'Fermer le panneau de la source',
    close: 'Fermer',
    openFullText: "Consulter le texte intégral chez l'éditeur",
    verifyText: "Vérifiez ce passage dans le manuel publié avant d'agir en conséquence.",
  },
  toolActivity: {
    running: {
      search_standards: 'Recherche dans les normes humanitaires',
      crisis_updates: 'Récupération des rapports de situation',
      humanitarian_data: 'Récupération des indicateurs du pays',
    },
    done: {
      search_standards: 'Normes humanitaires consultées',
      crisis_updates: 'Rapports de situation récupérés',
      humanitarian_data: 'Indicateurs du pays récupérés',
    },
    failed: 'Source en direct indisponible',
  },
  pending: {
    contacting: 'Connexion au modèle…',
    writing: 'Rédaction de la réponse…',
    elapsed: (seconds) => `${seconds} s`,
  },
  deliverables: {
    title: 'Livrables',
    description:
      "Générez une note de situation ou une section de rapport bailleur, fondée sur des sources récupérées — avec le détail du travail affiché à côté.",
    templateHeading: 'Choisissez un modèle',
    templates: {
      'situation-brief': {
        name: 'Note de situation',
        description:
          'Aléas, besoins et chiffres, financement et normes applicables — pour un pays.',
      },
      'donor-report-section': {
        name: 'Section de rapport bailleur',
        description:
          "Contexte, besoins et écarts, et la demande. Le récit des réalisations reste un gabarit à remplir avec vos propres données de suivi.",
      },
    },
    subjectLabelCountry: 'Pays',
    subjectLabelTopic: 'Programme ou thème',
    subjectPlaceholderCountry: 'ex. Soudan',
    subjectPlaceholderTopic: 'ex. programme EAH, nord du Nigéria',
    generate: 'Générer',
    generating: 'Génération',
    stop: 'Arrêter',
    reset: 'Recommencer',
    documentHeading: 'Document',
    documentEmpty: "Le document s'assemble ici, section par section.",
    copy: 'Copier',
    copied: 'Copié',
    download: 'Télécharger .md',
    partialNotice:
      "Cette exécution ne s'est pas terminée. Ce qui suit est seulement ce qui a été achevé — considérez-le comme partiel.",
    flaggedNotice: (count) =>
      count === 1
        ? "1 affirmation n'a pas pu être rattachée aux sources récupérées et est signalée dans le texte. Vérifiez-la avant d'utiliser ce document."
        : `${count} affirmations n'ont pas pu être rattachées aux sources récupérées et sont signalées dans le texte. Vérifiez-les avant d'utiliser ce document.`,
    traceHeading: 'Déroulé',
    traceExplainer:
      "Chaque source consultée et chaque affirmation vérifiée, dans l'ordre où cela s'est produit. Rien dans le document ne vient d'ailleurs.",
    traceEmpty: 'En attente de la première étape.',
    planHeading: 'Plan',
    steps: { plan: 'Plan', gather: 'Collecte', draft: 'Rédaction', verify: 'Vérification' },
    verdicts: { supported: 'Étayé', unsupported: 'Non étayé', unverifiable: 'Non vérifié' },
    done: 'Exécution terminée',
    doneWithFlags: (count) =>
      count === 1
        ? 'Exécution terminée — 1 affirmation signalée'
        : `Exécution terminée — ${count} affirmations signalées`,
    hasFlags: 'Contient des affirmations signalées',
    showWorking: 'Afficher le déroulé',
    hideWorking: 'Masquer le déroulé',
  },
  contentEnglishNote: "Ce contenu n'est disponible qu'en anglais.",
  playbooksPage: {
    title: 'Fiches pratiques',
    description:
      "Des conseils propres à chaque rôle sur les cas où HAI aide réellement, où il ne devrait pas être utilisé, et des exemples de questions à essayer — chacun expliquant pourquoi la question fonctionne, pas seulement quoi copier.",
  },
  playbookDetail: {
    backLink: 'Toutes les fiches pratiques',
    examplePromptsHeading: 'Exemples de questions',
    whyItWorks: 'Pourquoi ça marche :',
    tryInChat: 'Essayer dans le chat',
  },
  guidesPage: {
    title: 'Guides',
    description:
      "Des conseils généraux valables pour tous les rôles : comment bien formuler vos questions, comment utiliser l'IA de manière responsable avec des données humanitaires, et comment favoriser son adoption au sein de votre équipe.",
  },
  guideDetail: {
    backLink: 'Tous les guides',
  },
  footer: {
    sourcesHeading: 'Sources',
    dataHeading: 'Données en direct',
    docsHeading: 'En savoir plus',
    runsOnOpenModels:
      'Fonctionne avec des modèles ouverts — en local par défaut, sans dépendance au cloud.',
    sphereLabel: 'Manuel Sphère (2018)',
    chsLabel: 'Norme humanitaire fondamentale (2024)',
    iascLabel: "Orientations de l'IASC — responsabilité des données, protection, inclusion du handicap",
    hdxLabel: 'HDX HAPI — population, sécurité alimentaire, financement',
    ifrcLabel: 'IFRC GO — événements de crise',
  },
  about: {
    title: 'À propos de HAI',
    intro: 'Comment HAI est conçu pour être fiable dans le travail humanitaire.',
    grounded: {
      heading: 'Comment les réponses sont sourcées',
      body: "Chaque question suit trois étapes : rechercher, citer, vérifier. L'assistant récupère des passages du corpus de normes, cite la source, la section et la page, et le signale quand le corpus n'a rien à offrir — plutôt que de deviner.",
    },
    safety: {
      heading: 'La couche de sécurité',
      body: "Chaque message est filtré pour détecter des données identifiables sur les personnes affectées avant d'atteindre le modèle. Une correspondance est refusée, reliée explicitement au principe de l'IASC concerné, et accompagnée d'une reformulation sûre — jamais un simple refus.",
    },
    evals: {
      heading: 'Comment HAI est évalué',
      body: "Un ensemble de scénarios réservés est noté par un modèle juge d'une famille différente de celle testée, selon des faits attendus explicites. Les taux d'échec sont publiés, non dissimulés.",
    },
    limits: {
      heading: "Ce que HAI n'est pas",
      body: "Ne remplace pas le jugement professionnel, et n'est pas un espace pour des données identifiables sur les personnes affectées. HAI nomme ses sources pour que vous puissiez les vérifier — il ne remplace pas le manuel.",
    },
  },
};

const ar: Dictionary = {
  appName: 'HAI',
  tagline: 'مساعد العمليات الإنسانية',
  nav: {
    chat: 'المحادثة',
    deliverables: 'المخرجات',
    playbooks: 'الأدلة التطبيقية',
    guides: 'الإرشادات',
    about: 'حول',
  },
  localeSwitcher: {
    label: 'اللغة',
  },
  coach: {
    label: 'وضع التدريب',
    tooltip:
      'وضع التدريب: قبل الإجابة، يشير HAI بإيجاز إلى نقطة قوة وتحسين واحد في سؤالك، ثم يجيب على النسخة المحسّنة.',
  },
  composer: {
    placeholder: 'اسأل عن معيار أو مؤشر أو أزمة جارية…',
    ariaLabel: 'رسالة إلى HAI',
    send: 'إرسال',
    stop: 'إيقاف',
  },
  disclaimer: 'يقدّم HAI إرشادات مستندة إلى المعايير الإنسانية. وهو لا يحل محل الحكم المهني.',
  hostedNotice: {
    label: 'نسخة تجريبية مستضافة.',
    body: 'تُرسَل الرسائل إلى مزوّد نماذج خارجي. لا تُدخِل أي بيانات شخصية عن الأشخاص المتأثرين. شغّل HAI محليًا ليبقى كل شيء على جهازك.',
  },
  errorFallback: 'تعذّر على المساعد إتمام هذا الطلب. حاول مرة أخرى.',
  emptyState: {
    heading: 'معايير إنسانية، موثقة ومذكورة المصدر.',
    body: 'يجيب HAI استنادًا إلى دليل اسفير، والمعيار الإنساني الأساسي، وإرشادات اللجنة الدائمة المشتركة بين الوكالات (IASC)، ويستخرج بيانات حية للأزمات النشطة. كما يذكر مصادره حتى يمكنك التحقق منها في الدليل.',
    factsStrip: [
      '5 مصادر موثوقة',
      '1٬631 مقطعًا مُستشهدًا به',
      'اسفير 2018 · المعيار الإنساني الأساسي 2024 · 3 إرشادات من IASC',
    ],
    whatHaiDoes: [
      'إجابات موثقة، تستند كل معلومة فيها إلى مقطع مذكور المصدر.',
      'بيانات أزمات حية من HDX HAPI وIFRC GO، وليست مستذكرة من الذاكرة.',
      'أدلة تطبيقية لكل دور تغطي ست وظائف ميدانية، مع أمثلة يمكنك تجربتها.',
    ],
    limitsLine: 'لا يحل محل الحكم المهني. لا تُدخل أبدًا بيانات تحدد هوية الأشخاص المتأثرين.',
    suggestions: [
      {
        title: 'معايير اسفير الدنيا',
        prompt: 'ما هي معايير اسفير الدنيا لإمدادات المياه للفرد في اليوم؟',
      },
      {
        title: 'تقارير الحالة الحية',
        prompt: 'ما هي أحدث تقارير الحالة الخاصة بالسودان؟',
      },
      {
        title: 'مسؤولية البيانات',
        prompt: 'كيف يجب أن نتعامل مع بيانات المستفيدين التي يتم جمعها عند التسجيل؟',
      },
      {
        title: 'المساءلة أمام السكان المتضررين',
        prompt: 'ما هي التزامات المعيار الإنساني الأساسي بشأن المساءلة أمام السكان المتضررين؟',
      },
    ],
  },
  safetyNotice: {
    title: 'مسؤولية البيانات — لم تتم معالجة الرسالة',
    onePattern: 'تم اكتشاف نمط واحد',
    nPatterns: (count) => `تم اكتشاف ${count} أنماط`,
    screenedSuffix: 'وتمت تصفيتها قبل أن يطّلع النموذج على الرسالة. لم يتم تسجيل أو تخزين أي شيء.',
    principlesEngaged: 'مبادئ اللجنة الدائمة المشتركة بين الوكالات (IASC) المعنية:',
    readLink: 'اقرأ: الاستخدام المسؤول للذكاء الاصطناعي في العمل الإنساني',
  },
  citations: {
    sources: 'المصادر',
  },
  sourcePanel: {
    closePanel: 'إغلاق لوحة المصدر',
    close: 'إغلاق',
    openFullText: 'فتح النص الكامل لدى الناشر',
    verifyText: 'تحقق من هذا المقطع في الدليل المنشور قبل التصرف بناءً عليه.',
  },
  toolActivity: {
    running: {
      search_standards: 'جارٍ البحث في المعايير الإنسانية',
      crisis_updates: 'جارٍ جلب تقارير الحالة',
      humanitarian_data: 'جارٍ استرجاع مؤشرات البلد',
    },
    done: {
      search_standards: 'تم البحث في المعايير الإنسانية',
      crisis_updates: 'تم جلب تقارير الحالة',
      humanitarian_data: 'تم استرجاع مؤشرات البلد',
    },
    failed: 'المصدر الحي غير متاح',
  },
  pending: {
    contacting: 'جارٍ الاتصال بالنموذج…',
    writing: 'جارٍ كتابة الإجابة…',
    elapsed: (seconds) => `${seconds} ث`,
  },
  deliverables: {
    title: 'المخرجات',
    description:
      'أنشئ موجزاً عن الوضع أو قسماً من تقرير للمانحين، مستنداً إلى مصادر مسترجَعة — مع عرض كل خطوة من خطوات العمل بجانبه.',
    templateHeading: 'اختر قالباً',
    templates: {
      'situation-brief': {
        name: 'موجز الوضع',
        description: 'الأخطار والاحتياجات والأرقام والتمويل والمعايير المنطبقة — لبلد واحد.',
      },
      'donor-report-section': {
        name: 'قسم تقرير المانحين',
        description:
          'السياق والاحتياجات والفجوات والطلب. يبقى سرد الإنجازات قالباً تملؤه ببيانات الرصد الخاصة بك.',
      },
    },
    subjectLabelCountry: 'البلد',
    subjectLabelTopic: 'البرنامج أو الموضوع',
    subjectPlaceholderCountry: 'مثال: السودان',
    subjectPlaceholderTopic: 'مثال: برنامج المياه والإصحاح، شمال نيجيريا',
    generate: 'إنشاء',
    generating: 'جارٍ الإنشاء',
    stop: 'إيقاف',
    reset: 'البدء من جديد',
    documentHeading: 'المستند',
    documentEmpty: 'يُجمَّع المستند هنا، قسماً بعد قسم.',
    copy: 'نسخ',
    copied: 'تم النسخ',
    download: 'تنزيل ملف md.',
    partialNotice:
      'لم تكتمل هذه العملية. ما يظهر أدناه هو ما أُنجز فقط — تعامل معه على أنه جزئي.',
    flaggedNotice: (count) =>
      count === 1
        ? 'تعذّر ربط ادعاء واحد بالأدلة المسترجَعة، وقد جرى تعليمه في موضعه. تحقّق منه قبل استخدام هذا المستند.'
        : `تعذّر ربط ${count} ادعاءات بالأدلة المسترجَعة، وقد جرى تعليمها في مواضعها. تحقّق منها قبل استخدام هذا المستند.`,
    traceHeading: 'سير العمل',
    traceExplainer:
      'كل مصدر جرت استشارته وكل ادعاء جرى التحقق منه، بالترتيب الذي حدث به. لا شيء في المستند يأتي من مكان آخر.',
    traceEmpty: 'في انتظار الخطوة الأولى.',
    planHeading: 'الخطة',
    steps: { plan: 'التخطيط', gather: 'الجمع', draft: 'الصياغة', verify: 'التحقق' },
    verdicts: { supported: 'مدعوم', unsupported: 'غير مدعوم', unverifiable: 'غير مُتحقَّق منه' },
    done: 'اكتملت العملية',
    doneWithFlags: (count) =>
      count === 1
        ? 'اكتملت العملية — ادعاء واحد مُعلَّم'
        : `اكتملت العملية — ${count} ادعاءات مُعلَّمة`,
    hasFlags: 'يحتوي على ادعاءات مُعلَّمة',
    showWorking: 'إظهار سير العمل',
    hideWorking: 'إخفاء سير العمل',
  },
  contentEnglishNote: 'هذا المحتوى متاح باللغة الإنجليزية فقط.',
  playbooksPage: {
    title: 'الأدلة التطبيقية',
    description:
      'إرشادات خاصة بكل دور حول الحالات التي يساعد فيها HAI فعليًا، والحالات التي لا ينبغي فيها استخدامه، وأمثلة على أسئلة يمكنك تجربتها — مع توضيح سبب نجاح كل سؤال، وليس فقط نصّه الجاهز للنسخ.',
  },
  playbookDetail: {
    backLink: 'جميع الأدلة التطبيقية',
    examplePromptsHeading: 'أمثلة على الأسئلة',
    whyItWorks: 'لماذا ينجح هذا:',
    tryInChat: 'جرّب في المحادثة',
  },
  guidesPage: {
    title: 'الإرشادات',
    description:
      'إرشادات عامة تنطبق على جميع الأدوار: كيفية صياغة الأسئلة بشكل جيد، وكيفية استخدام الذكاء الاصطناعي بمسؤولية مع البيانات الإنسانية، وكيفية تعزيز تبنّيه داخل فريقك.',
  },
  guideDetail: {
    backLink: 'جميع الإرشادات',
  },
  footer: {
    sourcesHeading: 'المصادر',
    dataHeading: 'بيانات حية',
    docsHeading: 'لمزيد من المعلومات',
    runsOnOpenModels: 'يعمل بنماذج مفتوحة — محليًا بشكل افتراضي، دون الحاجة إلى الاعتماد على السحابة.',
    sphereLabel: 'دليل اسفير (2018)',
    chsLabel: 'المعيار الإنساني الأساسي (2024)',
    iascLabel: 'إرشادات IASC — مسؤولية البيانات، الحماية، إدماج الإعاقة',
    hdxLabel: 'HDX HAPI — السكان، الأمن الغذائي، التمويل',
    ifrcLabel: 'IFRC GO — أحداث الأزمات',
  },
  about: {
    title: 'عن HAI',
    intro: 'كيف صُمم HAI ليكون جديرًا بالثقة في العمل الإنساني.',
    grounded: {
      heading: 'كيف تُبنى الإجابات على مصادر موثقة',
      body: 'يمر كل سؤال بثلاث خطوات: البحث، ثم الاستشهاد، ثم التحقق. يسترجع المساعد مقاطع من مجموعة المعايير، ويذكر المصدر والقسم والصفحة، ويوضح عندما لا يجد في المجموعة ما يجيب عن السؤال — بدلًا من التخمين.',
    },
    safety: {
      heading: 'طبقة الأمان',
      body: 'تُفحص كل رسالة بحثًا عن بيانات تحدد هوية الأشخاص المتأثرين قبل أن تصل إلى النموذج. عند وجود تطابق، تُرفض الرسالة، ويُذكر مبدأ IASC المعني صراحةً، وتُقترح إعادة صياغة آمنة — لا مجرد رفض دون تفسير.',
    },
    evals: {
      heading: 'كيف يُقيَّم HAI',
      body: 'تُقيَّم مجموعة سيناريوهات مخصصة بواسطة نموذج حَكَم من عائلة مختلفة عن النموذج المُختبَر، استنادًا إلى حقائق متوقعة صريحة. تُنشر معدلات الإخفاق كما هي، دون تجميل.',
    },
    limits: {
      heading: 'ما لا يُعدّ عليه HAI',
      body: 'لا يحل محل الحكم المهني، وليس مكانًا لإدخال بيانات تحدد هوية الأشخاص المتأثرين. يذكر HAI مصادره لتتمكن من التحقق منها — فهو لا يحل محل الدليل نفسه.',
    },
  },
};

const es: Dictionary = {
  appName: 'HAI',
  tagline: 'Asistente de operaciones humanitarias',
  nav: {
    chat: 'Chat',
    deliverables: 'Entregables',
    playbooks: 'Manuales prácticos',
    guides: 'Guías',
    about: 'Acerca de',
  },
  localeSwitcher: {
    label: 'Idioma',
  },
  coach: {
    label: 'Modo coach',
    tooltip:
      'Modo coach: antes de responder, HAI señala brevemente un punto fuerte y una mejora en tu pregunta, y luego responde a la versión mejorada.',
  },
  composer: {
    placeholder: 'Pregunta sobre una norma, un indicador o una crisis en curso…',
    ariaLabel: 'Mensaje a HAI',
    send: 'Enviar',
    stop: 'Detener',
  },
  disclaimer:
    'HAI ofrece orientación basada en normas humanitarias. No sustituye el juicio profesional.',
  hostedNotice: {
    label: 'Demo alojada.',
    body: 'Los mensajes se envían a un proveedor de modelos externo. No introduzcas datos personales sobre personas afectadas. Ejecuta HAI en local para que todo permanezca en tu propia máquina.',
  },
  errorFallback: 'El asistente no pudo completar esa solicitud. Inténtalo de nuevo.',
  emptyState: {
    heading: 'Normas humanitarias, fundamentadas y citadas.',
    body: 'HAI responde a partir del Manual Esfera, la Norma Humanitaria Esencial y las orientaciones del IASC, y obtiene cifras actualizadas sobre las crisis activas. Cita sus fuentes para que puedas verificarlas en el manual.',
    factsStrip: [
      '5 fuentes autorizadas',
      '1631 pasajes citados',
      'Esfera 2018 · Norma Humanitaria Esencial 2024 · 3 orientaciones del IASC',
    ],
    whatHaiDoes: [
      'Respuestas fundamentadas, cada afirmación remitida a un pasaje citado.',
      'Datos de crisis en vivo de HDX HAPI e IFRC GO, no cifras memorizadas.',
      'Manuales prácticos por rol para seis funciones de campo, con ejemplos para probar.',
    ],
    limitsLine:
      'No sustituye el juicio profesional. Nunca introduzcas datos identificables sobre personas afectadas.',
    suggestions: [
      {
        title: 'Normas mínimas Esfera',
        prompt:
          '¿Cuáles son las normas mínimas Esfera para el suministro de agua por persona y por día?',
      },
      {
        title: 'Informes de situación en vivo',
        prompt: '¿Cuáles son los últimos informes de situación para Sudán?',
      },
      {
        title: 'Responsabilidad de los datos',
        prompt: '¿Cómo deberíamos manejar los datos de los beneficiarios recopilados en la inscripción?',
      },
      {
        title: 'Rendición de cuentas a la población afectada',
        prompt:
          '¿Cuáles son los compromisos de la Norma Humanitaria Esencial sobre la rendición de cuentas a la población afectada?',
      },
    ],
  },
  safetyNotice: {
    title: 'Responsabilidad de los datos — mensaje no procesado',
    onePattern: 'Se detectó un patrón',
    nPatterns: (count) => `Se detectaron ${count} patrones`,
    screenedSuffix:
      'y se filtraron antes de que el modelo viera el mensaje. No se registró ni almacenó nada.',
    principlesEngaged: 'Principios del IASC involucrados:',
    readLink: 'Leer: Uso responsable de la IA en el trabajo humanitario',
  },
  citations: {
    sources: 'Fuentes',
  },
  sourcePanel: {
    closePanel: 'Cerrar el panel de la fuente',
    close: 'Cerrar',
    openFullText: 'Abrir el texto completo en la fuente original',
    verifyText: 'Verifica este pasaje en el manual publicado antes de actuar en consecuencia.',
  },
  toolActivity: {
    running: {
      search_standards: 'Buscando en las normas humanitarias',
      crisis_updates: 'Obteniendo informes de situación',
      humanitarian_data: 'Recuperando indicadores del país',
    },
    done: {
      search_standards: 'Normas humanitarias consultadas',
      crisis_updates: 'Informes de situación obtenidos',
      humanitarian_data: 'Indicadores del país recuperados',
    },
    failed: 'Fuente en vivo no disponible',
  },
  pending: {
    contacting: 'Contactando con el modelo…',
    writing: 'Redactando la respuesta…',
    elapsed: (seconds) => `${seconds} s`,
  },
  deliverables: {
    title: 'Entregables',
    description:
      'Genera una nota de situación o una sección de informe para donantes, fundamentada en fuentes recuperadas — con cada paso del trabajo a la vista.',
    templateHeading: 'Elige una plantilla',
    templates: {
      'situation-brief': {
        name: 'Nota de situación',
        description:
          'Amenazas, necesidades y cifras, financiación y las normas aplicables — para un país.',
      },
      'donor-report-section': {
        name: 'Sección de informe para donantes',
        description:
          'Contexto, necesidades y brechas, y la petición. El relato de logros queda como plantilla para tus propios datos de seguimiento.',
      },
    },
    subjectLabelCountry: 'País',
    subjectLabelTopic: 'Programa o tema',
    subjectPlaceholderCountry: 'p. ej. Sudán',
    subjectPlaceholderTopic: 'p. ej. programa de agua y saneamiento, norte de Nigeria',
    generate: 'Generar',
    generating: 'Generando',
    stop: 'Detener',
    reset: 'Empezar de nuevo',
    documentHeading: 'Documento',
    documentEmpty: 'El documento se va montando aquí, sección a sección.',
    copy: 'Copiar',
    copied: 'Copiado',
    download: 'Descargar .md',
    partialNotice:
      'Esta ejecución no terminó. Lo que aparece debajo es solo lo que se completó — trátalo como parcial.',
    flaggedNotice: (count) =>
      count === 1
        ? '1 afirmación no pudo vincularse a las fuentes recuperadas y está señalada en el texto. Verifícala antes de usar este documento.'
        : `${count} afirmaciones no pudieron vincularse a las fuentes recuperadas y están señaladas en el texto. Verifícalas antes de usar este documento.`,
    traceHeading: 'Proceso',
    traceExplainer:
      'Cada fuente consultada y cada afirmación verificada, en el orden en que ocurrió. Nada del documento procede de otro sitio.',
    traceEmpty: 'Esperando el primer paso.',
    planHeading: 'Plan',
    steps: { plan: 'Plan', gather: 'Recopilación', draft: 'Redacción', verify: 'Verificación' },
    verdicts: {
      supported: 'Respaldado',
      unsupported: 'Sin respaldo',
      unverifiable: 'Sin verificar',
    },
    done: 'Ejecución completada',
    doneWithFlags: (count) =>
      count === 1
        ? 'Ejecución completada — 1 afirmación señalada'
        : `Ejecución completada — ${count} afirmaciones señaladas`,
    hasFlags: 'Contiene afirmaciones señaladas',
    showWorking: 'Mostrar el proceso',
    hideWorking: 'Ocultar el proceso',
  },
  contentEnglishNote: 'Este contenido solo está disponible en inglés.',
  playbooksPage: {
    title: 'Manuales prácticos',
    description:
      'Orientación específica por rol sobre dónde HAI realmente ayuda, dónde no debería usarse, y ejemplos de preguntas que puedes probar — cada una explicando por qué funciona, no solo qué copiar y pegar.',
  },
  playbookDetail: {
    backLink: 'Todos los manuales prácticos',
    examplePromptsHeading: 'Ejemplos de preguntas',
    whyItWorks: 'Por qué funciona:',
    tryInChat: 'Probar en el chat',
  },
  guidesPage: {
    title: 'Guías',
    description:
      'Orientación general aplicable a todos los roles: cómo formular bien las preguntas, cómo usar la IA de forma responsable con datos humanitarios, y cómo fomentar su adopción en tu equipo.',
  },
  guideDetail: {
    backLink: 'Todas las guías',
  },
  footer: {
    sourcesHeading: 'Fuentes',
    dataHeading: 'Datos en vivo',
    docsHeading: 'Más información',
    runsOnOpenModels: 'Funciona con modelos abiertos — local por defecto, sin depender de la nube.',
    sphereLabel: 'Manual Esfera (2018)',
    chsLabel: 'Norma Humanitaria Esencial (2024)',
    iascLabel: 'Orientaciones del IASC — responsabilidad de datos, protección, inclusión de discapacidad',
    hdxLabel: 'HDX HAPI — población, seguridad alimentaria, financiación',
    ifrcLabel: 'IFRC GO — eventos de crisis',
  },
  about: {
    title: 'Acerca de HAI',
    intro: 'Cómo está construido HAI para ser confiable en el trabajo humanitario.',
    grounded: {
      heading: 'Cómo se fundamentan las respuestas',
      body: 'Cada pregunta pasa por tres pasos: buscar, citar y verificar. El asistente recupera pasajes del corpus de normas, cita la fuente, la sección y la página, y lo indica cuando el corpus no tiene nada que ofrecer — en lugar de adivinar.',
    },
    safety: {
      heading: 'La capa de seguridad',
      body: 'Cada mensaje se examina en busca de datos identificables sobre personas afectadas antes de llegar al modelo. Una coincidencia se rechaza, se vincula explícitamente al principio del IASC en juego, y se ofrece una reformulación segura — nunca un rechazo sin explicación.',
    },
    evals: {
      heading: 'Cómo se evalúa',
      body: 'Un conjunto reservado de escenarios es calificado por un modelo juez de una familia distinta a la evaluada, según hechos esperados explícitos. Las tasas de fallo se publican, no se disimulan.',
    },
    limits: {
      heading: 'Lo que HAI no es',
      body: 'No sustituye el juicio profesional, y no es un lugar para datos identificables sobre personas afectadas. HAI nombra sus fuentes para que puedas verificarlas — no reemplaza el manual.',
    },
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, ar, es };
