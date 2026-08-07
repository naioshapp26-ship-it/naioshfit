export type EpicKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type EpicUIConfig = {
  key: EpicKey;
  title: string;
  summary: string;
  status: string;
  readiness: number;
  pillar: string;
  uiComponents: string[];
  highlights: string[];
};

export const platformStats = [
  { label: "Database tables", value: "67", detail: "Covering all 12 epics with tenant isolation" },
  { label: "API endpoints", value: "160+", detail: "Documented and validated with Zod" },
  { label: "Migrations", value: "12 (0020-0031)", detail: "Database foundation complete" },
  { label: "Architecture", value: "Multi-tenant", detail: "Per-tenant isolation & RBAC" },
  { label: "Security", value: "Enterprise-grade", detail: "Encryption, audit trails, GDPR-ready" },
  { label: "Languages", value: "Arabic & English", detail: "Full bilingual support" },
  { label: "Tech", value: "100% TypeScript", detail: "React + Express + Zod validation" },
  { label: "Build", value: "Passing", detail: "Backend & client compiled successfully" },
];

export const epicUIConfigs: EpicUIConfig[] = [
  {
    key: "A",
    title: "Supplements Core",
    summary: "Catalog, recommendations, and interaction safety with bilingual coverage.",
    status: "UI shell ready for wiring",
    readiness: 88,
    pillar: "Supplements",
    uiComponents: [
      "Supplements catalog & search",
      "My recommendations",
      "Coach recommendation desk",
      "Admin catalog management",
    ],
    highlights: [
      "Dosage & timing guidance",
      "Interaction & allergy warnings",
      "Coach-scoped supplements",
    ],
  },
  {
    key: "B",
    title: "Supplements Follow-up",
    summary: "Reminder cadence, side-effect logging, and effectiveness feedback.",
    status: "UI shell ready for wiring",
    readiness: 86,
    pillar: "Supplements",
    uiComponents: [
      "Reminder scheduler",
      "Side effect logger",
      "Escalation triage",
      "Effectiveness ratings",
    ],
    highlights: [
      "Photo & severity capture",
      "Multi-channel reminders",
      "Auto-escalation rules",
    ],
  },
  {
    key: "C",
    title: "Smart Alerts & Notifications",
    summary: "Multi-channel alerts with templates, digests, and preference center.",
    status: "UI shell ready for wiring",
    readiness: 85,
    pillar: "Engagement",
    uiComponents: [
      "Alert templates & composer",
      "Rule & channel matrix",
      "User preference center",
      "Digest scheduling",
    ],
    highlights: [
      "Push, SMS, email routing",
      "Motivational templates",
      "Missed workout detection",
    ],
  },
  {
    key: "D",
    title: "Files & Reports",
    summary: "Secure vault, uploads, and coach-ready report builder.",
    status: "UI shell ready for wiring",
    readiness: 84,
    pillar: "Data & Compliance",
    uiComponents: [
      "File vault & uploader",
      "Report templates",
      "Scan & validation queue",
      "Audit log viewer",
    ],
    highlights: [
      "PII-safe handling",
      "Progress snapshot gallery",
      "Export to PDF",
    ],
  },
  {
    key: "E",
    title: "AI Assistant",
    summary: "Coach-in-the-loop AI with safety guardrails and plan builders.",
    status: "UI shell ready for wiring",
    readiness: 87,
    pillar: "AI",
    uiComponents: [
      "Chat & coach inbox",
      "Plan builder with AI",
      "Content summarizer",
      "Escalation & override",
    ],
    highlights: [
      "Goal-aware suggestions",
      "Audit-ready transcripts",
      "Safety filters on prompts",
    ],
  },
  {
    key: "F",
    title: "Community & Engagement",
    summary: "Social feed, challenges, groups, and workshops for retention.",
    status: "UI shell ready for wiring",
    readiness: 83,
    pillar: "Engagement",
    uiComponents: [
      "Social feed & reactions",
      "Challenges hub & leaderboard",
      "Groups & discussions",
      "Workshops & referrals",
    ],
    highlights: [
      "Goal-based groups",
      "Achievement sharing",
      "Referral rewards",
    ],
  },
  {
    key: "G",
    title: "Educational Content Hub",
    summary: "Bilingual content library with ratings, bookmarks, and progress.",
    status: "UI shell ready for wiring",
    readiness: 82,
    pillar: "Content",
    uiComponents: [
      "Content library grid/list",
      "Article/video viewer",
      "Coach content manager",
      "FAQ search",
    ],
    highlights: [
      "Visibility controls",
      "Bookmarks & ratings",
      "Video progress tracking",
    ],
  },
  {
    key: "H",
    title: "Payments & Subscriptions",
    summary: "Plans, payment methods, invoices, and financial analytics.",
    status: "UI shell ready for wiring",
    readiness: 85,
    pillar: "Billing",
    uiComponents: [
      "Subscription plans",
      "Payment methods manager",
      "Billing history",
      "Financial dashboard",
    ],
    highlights: [
      "Multi-provider support",
      "Refund workflow",
      "MRR/ARR metrics",
    ],
  },
  {
    key: "I",
    title: "Taxonomy, Archiving, Search & Backup",
    summary: "Unified taxonomy, archive policies, global search, and backups.",
    status: "UI shell ready for wiring",
    readiness: 83,
    pillar: "Data",
    uiComponents: [
      "Taxonomy manager",
      "Archive policy console",
      "Universal search",
      "Backup & restore board",
    ],
    highlights: [
      "Entity-level tagging",
      "Policy-based retention",
      "Search history insights",
    ],
  },
  {
    key: "J",
    title: "Ads Management",
    summary: "Manage ads, top-bar announcements, and shared categories in one console.",
    status: "UI shell ready for wiring",
    readiness: 82,
    pillar: "Growth",
    uiComponents: [
      "Ad campaign manager",
      "Courses catalog",
      "Course player",
      "Certificate viewer",
    ],
    highlights: [
      "A/B testing support",
      "Module → lesson hierarchy",
      "Quiz scoring",
    ],
  },
  {
    key: "K",
    title: "Multi-Partner SaaS",
    summary: "Tenant-aware experiences with branding, limits, and partner KPIs.",
    status: "UI shell ready for wiring",
    readiness: 84,
    pillar: "SaaS",
    uiComponents: [
      "Tenant switcher",
      "Branding theming",
      "Resource limits monitor",
      "Partner analytics",
    ],
    highlights: [
      "Per-tenant isolation",
      "Custom domains ready",
      "Usage enforcement",
    ],
  },
  {
    key: "L",
    title: "System Infrastructure, Security & KPIs",
    summary: "Security center, observability, and SLA dashboards.",
    status: "UI shell ready for wiring",
    readiness: 85,
    pillar: "Platform",
    uiComponents: [
      "Security operations board",
      "Audit & incident center",
      "KPI & SLA dashboards",
      "Maintenance windows",
    ],
    highlights: [
      "Encryption posture",
      "Audit trails",
      "Operational runbooks",
    ],
  },
];
