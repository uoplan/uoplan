/**
 * Long-form legal copy (Privacy Policy + Terms of Service), co-located in both
 * supported locales.
 *
 * These two documents are intentionally NOT routed through the Lingui message
 * catalogs (`@uoplan/i18n` PO files): legal prose is long, edited as a whole,
 * and translated together, so keeping each language as one reviewable block is
 * clearer than scattering dozens of `tr()` ids across the catalog. The routes
 * (`/privacy`, `/terms`) pick the block for the active locale via `i18n.locale`
 * and re-render on locale change through `useTr()`.
 *
 * NOTE: this is a good-faith, plain-language draft authored from the app's
 * actual data behaviour — it is not legal advice and should be reviewed before
 * relying on it.
 */
import type { AppLocale } from "../i18n";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT_EMAIL = "admin@uoplan.party";

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  lastUpdated: "Last updated: June 18, 2026",
  intro:
    "uoPlan is a free, independent course planner for University of Ottawa students. This policy explains what information the service handles and, just as importantly, what it deliberately does not.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        "uoPlan is an independent, student-run project. It is not affiliated with, endorsed by, or sponsored by the University of Ottawa.",
        `You can reach us at ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "Information we process",
      paragraphs: ["We keep data collection to the minimum needed to run the planner:"],
      bullets: [
        "University data (public): course, program, schedule, and grade-distribution data sourced from public University of Ottawa pages. This is reference data — it is not personal information about you.",
        "Your planning choices: the term, program, completed courses, and preferences you enter are stored locally on your device. They are encoded into a share link only when you choose to create one, and are not tied to any account.",
        "Transcript import: if you import a transcript PDF, it is parsed entirely on your device to read your completed courses. The file and its contents are never uploaded to us.",
        "Notifications (optional): if you turn on schedule reminders, we store only what is needed to deliver them — on the web, your browser's push subscription; in the app, a device notification token. You can turn these off at any time.",
        "Technical data: like most websites, our hosting provider (Cloudflare) processes standard request information such as IP address and browser type to operate and secure the service. Cloudflare Turnstile is used to prevent abuse of the notification feature.",
      ],
    },
    {
      heading: "What we do not do",
      bullets: [
        "No advertising and no advertising identifiers.",
        "No third-party analytics or tracking SDKs.",
        "No selling, renting, or trading of personal information.",
        "No user accounts or behavioural profiles.",
      ],
    },
    {
      heading: "How information is stored",
      paragraphs: [
        "Your planning data lives in your browser or device storage and can be removed at any time by clearing the site's data or uninstalling the app.",
        "Notification subscriptions are stored by our hosting provider only while you remain subscribed, and are deleted when you unsubscribe.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "uoPlan is intended for university students and a general adult audience. It is not directed to children under 13, and we do not knowingly collect personal information from them.",
      ],
    },
    {
      heading: "Your choices",
      bullets: [
        "Clear your local planning data at any time from your browser or device.",
        "Unsubscribe from reminders to remove any stored notification subscription.",
        `Contact us at ${CONTACT_EMAIL} with any privacy question or request.`,
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "We may update this policy from time to time. Material changes will be reflected on this page with a new date above.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about privacy? Email ${CONTACT_EMAIL}.`],
    },
  ],
};

const privacyFr: LegalDoc = {
  title: "Politique de confidentialité",
  lastUpdated: "Dernière mise à jour : 18 juin 2026",
  intro:
    "uoPlan est un planificateur de cours gratuit et indépendant pour les étudiants de l'Université d'Ottawa. Cette politique explique quels renseignements le service traite et, tout aussi important, ce qu'il choisit délibérément de ne pas faire.",
  sections: [
    {
      heading: "Qui nous sommes",
      paragraphs: [
        "uoPlan est un projet indépendant géré par des étudiants. Il n'est ni affilié à l'Université d'Ottawa, ni approuvé ou commandité par celle-ci.",
        `Vous pouvez nous joindre à ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: "Renseignements que nous traitons",
      paragraphs: [
        "Nous limitons la collecte de données au strict nécessaire au fonctionnement du planificateur :",
      ],
      bullets: [
        "Données universitaires (publiques) : données sur les cours, les programmes, les horaires et la répartition des notes provenant des pages publiques de l'Université d'Ottawa. Ce sont des données de référence — ce ne sont pas des renseignements personnels vous concernant.",
        "Vos choix de planification : le trimestre, le programme, les cours réussis et les préférences que vous saisissez sont stockés localement sur votre appareil. Ils sont encodés dans un lien de partage uniquement lorsque vous choisissez d'en créer un, et ne sont liés à aucun compte.",
        "Importation de relevé : si vous importez un relevé en PDF, il est analysé entièrement sur votre appareil afin de lire vos cours réussis. Le fichier et son contenu ne nous sont jamais transmis.",
        "Notifications (facultatives) : si vous activez les rappels d'horaire, nous ne stockons que ce qui est nécessaire à leur envoi — sur le Web, l'abonnement push de votre navigateur; dans l'application, un jeton de notification de l'appareil. Vous pouvez les désactiver à tout moment.",
        "Données techniques : comme la plupart des sites Web, notre hébergeur (Cloudflare) traite des renseignements de requête standard tels que l'adresse IP et le type de navigateur pour exploiter et sécuriser le service. Cloudflare Turnstile sert à prévenir l'utilisation abusive de la fonction de notification.",
      ],
    },
    {
      heading: "Ce que nous ne faisons pas",
      bullets: [
        "Aucune publicité ni identifiant publicitaire.",
        "Aucun outil d'analyse ou de pistage tiers.",
        "Aucune vente, location ou échange de renseignements personnels.",
        "Aucun compte d'utilisateur ni profil comportemental.",
      ],
    },
    {
      heading: "Conservation des renseignements",
      paragraphs: [
        "Vos données de planification résident dans le stockage de votre navigateur ou de votre appareil et peuvent être supprimées à tout moment en effaçant les données du site ou en désinstallant l'application.",
        "Les abonnements aux notifications sont conservés par notre hébergeur uniquement tant que vous restez abonné, et sont supprimés lorsque vous vous désabonnez.",
      ],
    },
    {
      heading: "Enfants",
      paragraphs: [
        "uoPlan s'adresse aux étudiants universitaires et à un public adulte général. Il ne vise pas les enfants de moins de 13 ans, et nous ne recueillons pas sciemment de renseignements personnels les concernant.",
      ],
    },
    {
      heading: "Vos choix",
      bullets: [
        "Effacez vos données de planification locales à tout moment depuis votre navigateur ou votre appareil.",
        "Désabonnez-vous des rappels pour supprimer tout abonnement de notification stocké.",
        `Écrivez-nous à ${CONTACT_EMAIL} pour toute question ou demande relative à la confidentialité.`,
      ],
    },
    {
      heading: "Modifications de cette politique",
      paragraphs: [
        "Nous pouvons mettre à jour cette politique de temps à autre. Les changements importants seront indiqués sur cette page avec une nouvelle date ci-dessus.",
      ],
    },
    {
      heading: "Nous joindre",
      paragraphs: [`Des questions sur la confidentialité? Écrivez à ${CONTACT_EMAIL}.`],
    },
  ],
};

const termsEn: LegalDoc = {
  title: "Terms of Service",
  lastUpdated: "Last updated: June 18, 2026",
  intro:
    "These terms govern your use of uoPlan, a free and independent University of Ottawa course planner. Please read them before using the service.",
  sections: [
    {
      heading: "Acceptance",
      paragraphs: [
        "By using uoPlan, you agree to these terms. If you do not agree, please do not use the service.",
      ],
    },
    {
      heading: "What uoPlan is",
      paragraphs: [
        "uoPlan is a free planning tool that helps you explore University of Ottawa program requirements and build candidate weekly timetables. It is offered as-is to help you plan.",
      ],
    },
    {
      heading: "Not affiliated and not official advice",
      paragraphs: [
        "uoPlan is an independent, student-run project and is not affiliated with, endorsed by, or sponsored by the University of Ottawa.",
        "The information shown may be inaccurate, incomplete, or out of date, and is not official academic advice. Always confirm requirements, course availability, schedules, and enrolment with the University and its official systems before relying on anything here.",
      ],
    },
    {
      heading: "Acceptable use",
      bullets: [
        "Do not attempt to disrupt, overload, reverse-engineer, or interfere with the service or its infrastructure.",
        "Do not scrape or access the service in an abusive or automated way that harms its operation.",
        "Do not use the service for any unlawful purpose or to harm others.",
      ],
    },
    {
      heading: "Intellectual property",
      paragraphs: [
        "The uoPlan name, design, and code belong to the project (the source code is available under the licence in its public repository).",
        "University course information, program names, and related marks remain the property of their respective owners. uoPlan claims no ownership of University of Ottawa trademarks or content.",
      ],
    },
    {
      heading: "Donations",
      paragraphs: [
        "Donations are entirely voluntary and help cover hosting and upkeep. They are non-refundable, are not tax-deductible, and do not unlock any additional features, goods, or services.",
      ],
    },
    {
      heading: "No warranty",
      paragraphs: [
        'The service is provided "as is" and "as available", without warranties of any kind, whether express or implied, including fitness for a particular purpose and accuracy of data.',
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "To the fullest extent permitted by law, the project and its contributors are not liable for any damages arising from your use of, or inability to use, the service — including missed deadlines, enrolment problems, or scheduling errors.",
      ],
    },
    {
      heading: "Changes and availability",
      paragraphs: [
        "We may change, suspend, or discontinue any part of the service at any time, and may update these terms. Continued use after an update means you accept the revised terms.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These terms are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict-of-law rules.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [`Questions about these terms? Email ${CONTACT_EMAIL}.`],
    },
  ],
};

const termsFr: LegalDoc = {
  title: "Conditions d'utilisation",
  lastUpdated: "Dernière mise à jour : 18 juin 2026",
  intro:
    "Ces conditions régissent votre utilisation de uoPlan, un planificateur de cours gratuit et indépendant pour l'Université d'Ottawa. Veuillez les lire avant d'utiliser le service.",
  sections: [
    {
      heading: "Acceptation",
      paragraphs: [
        "En utilisant uoPlan, vous acceptez ces conditions. Si vous ne les acceptez pas, veuillez ne pas utiliser le service.",
      ],
    },
    {
      heading: "Ce qu'est uoPlan",
      paragraphs: [
        "uoPlan est un outil de planification gratuit qui vous aide à explorer les exigences des programmes de l'Université d'Ottawa et à créer des horaires hebdomadaires possibles. Il est offert tel quel pour faciliter votre planification.",
      ],
    },
    {
      heading: "Aucune affiliation et aucun avis officiel",
      paragraphs: [
        "uoPlan est un projet indépendant géré par des étudiants; il n'est ni affilié à l'Université d'Ottawa, ni approuvé ou commandité par celle-ci.",
        "Les renseignements affichés peuvent être inexacts, incomplets ou périmés, et ne constituent pas un avis scolaire officiel. Confirmez toujours les exigences, la disponibilité des cours, les horaires et l'inscription auprès de l'Université et de ses systèmes officiels avant de vous y fier.",
      ],
    },
    {
      heading: "Utilisation acceptable",
      bullets: [
        "Ne tentez pas de perturber, de surcharger, de rétroconcevoir ou de nuire au service ou à son infrastructure.",
        "N'extrayez pas et n'accédez pas au service de manière abusive ou automatisée qui nuit à son fonctionnement.",
        "N'utilisez pas le service à des fins illégales ou pour nuire à autrui.",
      ],
    },
    {
      heading: "Propriété intellectuelle",
      paragraphs: [
        "Le nom, le design et le code de uoPlan appartiennent au projet (le code source est disponible selon la licence figurant dans son dépôt public).",
        "Les renseignements sur les cours, les noms de programmes et les marques connexes de l'Université demeurent la propriété de leurs titulaires respectifs. uoPlan ne revendique aucun droit sur les marques de commerce ou le contenu de l'Université d'Ottawa.",
      ],
    },
    {
      heading: "Dons",
      paragraphs: [
        "Les dons sont entièrement volontaires et aident à couvrir l'hébergement et l'entretien. Ils ne sont pas remboursables, ne sont pas déductibles d'impôt et ne débloquent aucune fonctionnalité, aucun bien ni aucun service supplémentaire.",
      ],
    },
    {
      heading: "Aucune garantie",
      paragraphs: [
        "Le service est fourni « tel quel » et « selon disponibilité », sans garantie d'aucune sorte, expresse ou implicite, y compris quant à son adéquation à un usage particulier et à l'exactitude des données.",
      ],
    },
    {
      heading: "Limitation de responsabilité",
      paragraphs: [
        "Dans toute la mesure permise par la loi, le projet et ses contributeurs ne sont pas responsables des dommages découlant de votre utilisation du service ou de votre incapacité à l'utiliser — y compris les échéances manquées, les problèmes d'inscription ou les erreurs d'horaire.",
      ],
    },
    {
      heading: "Modifications et disponibilité",
      paragraphs: [
        "Nous pouvons modifier, suspendre ou interrompre toute partie du service à tout moment, et mettre à jour ces conditions. Le fait de continuer à utiliser le service après une mise à jour signifie que vous acceptez les conditions révisées.",
      ],
    },
    {
      heading: "Droit applicable",
      paragraphs: [
        "Ces conditions sont régies par les lois de la province de l'Ontario et les lois fédérales du Canada qui y sont applicables, sans égard aux règles de conflit de lois.",
      ],
    },
    {
      heading: "Nous joindre",
      paragraphs: [`Des questions sur ces conditions? Écrivez à ${CONTACT_EMAIL}.`],
    },
  ],
};

export const PRIVACY_BY_LOCALE: Record<AppLocale, LegalDoc> = {
  en: privacyEn,
  "fr-CA": privacyFr,
};

export const TERMS_BY_LOCALE: Record<AppLocale, LegalDoc> = {
  en: termsEn,
  "fr-CA": termsFr,
};
