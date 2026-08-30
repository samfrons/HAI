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
    playbooks: string;
    guides: string;
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
}

const en: Dictionary = {
  appName: 'HAI',
  tagline: 'Humanitarian operations assistant',
  nav: {
    chat: 'Chat',
    playbooks: 'Playbooks',
    guides: 'Guides',
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
};

const fr: Dictionary = {
  appName: 'HAI',
  tagline: 'Assistant pour les opérations humanitaires',
  nav: {
    chat: 'Discussion',
    playbooks: 'Fiches pratiques',
    guides: 'Guides',
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
};

const ar: Dictionary = {
  appName: 'HAI',
  tagline: 'مساعد العمليات الإنسانية',
  nav: {
    chat: 'المحادثة',
    playbooks: 'الأدلة التطبيقية',
    guides: 'الإرشادات',
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
};

const es: Dictionary = {
  appName: 'HAI',
  tagline: 'Asistente de operaciones humanitarias',
  nav: {
    chat: 'Chat',
    playbooks: 'Manuales prácticos',
    guides: 'Guías',
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
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, ar, es };
