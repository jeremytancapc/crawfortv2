/**
 * Seeded mock data for AirConnect - the call-centre agent CRM.
 * Client-only: generated with Date.now()/Math.random(), so this must never be
 * evaluated during SSR (see app/airconnect/airconnect-loader.tsx, which loads
 * the workspace with ssr: false to avoid hydration mismatches).
 */

import type { Agent, AgentId, CloseReason, EligibilityTag, ForeignerDocTag, IncomeDocTag, Lead, LeadSource, LeadStatus, LeadTags, NoteEntry, QualifyingReason } from "./types";
import { CLOSE_REASON_ORDER } from "./types";
import { ELIGIBILITY_OPTIONS, emptyLeadTags } from "./tags";

export const AGENTS: Agent[] = [
  { id: "agent-a", name: "Heryana", initials: "H", colorHex: "#FFD100" },
  { id: "agent-b", name: "Willi", initials: "W", colorHex: "#0033AA" },
  { id: "agent-c", name: "Radah", initials: "R", colorHex: "#3F3F46" },
];

const AGENT_BAR_CLASS: Record<AgentId, string> = {
  "agent-a": "bg-[#FFD100]",
  "agent-b": "bg-[var(--brand-blue-hex)]",
  "agent-c": "bg-zinc-700",
};

const AGENT_TEXT_CLASS: Record<AgentId, string> = {
  "agent-a": "text-zinc-950",
  "agent-b": "text-white",
  "agent-c": "text-white",
};

/** Stable per-lead pick so Heryana / Willi / Radah mix in a single queue. */
export function assignedAgentForLead(leadId: string): Agent & { barClass: string; textClass: string } {
  let hash = 0;
  for (let i = 0; i < leadId.length; i += 1) {
    hash = (hash + leadId.charCodeAt(i) * (i + 1)) % AGENTS.length;
  }
  const agent = AGENTS[hash] ?? AGENTS[0];
  return { ...agent, barClass: AGENT_BAR_CLASS[agent.id], textClass: AGENT_TEXT_CLASS[agent.id] };
}

const NAMES = [
  "Ahmad Syafiq Bin Zulkifli", "Choi Ai Jin", "Muhammad Assyafiee Bin Rahman",
  "Saraswathi Sivakumar", "Vimal Raj Suresh", "Khairullah Bin Abdullah",
  "Daryl Choy", "Brandon Lim Zhi Wei", "Nurfaslinda Binte Yusof",
  "Mohamad Khairul Anam", "Tamil Chelvi", "Rasanavaneetha Devi",
  "Syed Ashraf", "Muthusamy Subramaniam", "Syarif Katerman",
  "Siti Noor Aina Binte Ismail", "Syahirah Rahman", "Mike Kyle Padilla Tan",
  "Lee Kok Yong", "Gunaselan Muthu", "Francis Chng", "Wai Lin Phyo",
  "Jimness Kim", "Shaanker Rao", "Maneka Devi", "Mohamed Ibrahim Bin Aziz",
  "Mohd Ariffin", "Mr Wang Cheng Kai", "Neo Kah Hoe", "Muhammad Afdzal Hakim",
  "Chan Yew Ming", "Ong Cheow Koon", "Tan Kim Ting Jacqlyn", "Muhammad Hazique Farhan",
  "Priya Menon", "Kelvin Goh", "Nur Amirah Binte Zainal", "Vincent Teo",
  "Anitha Krishnan", "Faridah Binte Salleh", "Jason Koh", "Deepak Nair",
  "Wong Li Ting", "Hafiz Bin Rosli", "Cheryl Ang", "Suresh Pillai",
  "Aminah Binte Yusoff", "Ryan Tay", "Nabila Binte Hussein", "Terence Foo",
  "Kavitha Ramasamy", "Amir Hakim Bin Zulkarnain", "Serene Lim", "Danish Iqbal",
  "Poh Choo Hoon", "Farah Nabila", "Justin Chua", "Meera Nair",
  "Zaidi Bin Ismail", "Yong Sook Ling",
];

const SOURCES: LeadSource[] = ["SEO", "1% Loan", "MoneyRight", "Lendela", "Loanable", "Referral"];

const AMOUNTS = ["3K", "5K", "8K", "10K", "12K", "15K", "20K"];

const STATUS_POOL: { status: LeadStatus; weight: number }[] = [
  { status: "new", weight: 6 },
  { status: "assigned", weight: 22 },
  { status: "no-response", weight: 10 },
  { status: "qualifying", weight: 16 },
  { status: "pending-booking", weight: 8 },
  { status: "booked", weight: 8 },
  { status: "not-eligible", weight: 6 },
  { status: "done", weight: 8 },
];

const NOTE_TEMPLATES_BY_STATUS: Partial<Record<LeadStatus, string[]>> = {
  "no-response": ["No answer - no activity 3 days.", "Tried calling twice, straight to voicemail.", "WhatsApp sent, awaiting reply."],
  qualifying: ["Interested, checking documents.", "Asked to call back in the evening.", "Comparing rates with another lender."],
  "pending-booking": ["Confirmed interest, needs to check calendar.", "Wants appointment next week.", "Requested morning slot."],
  assigned: ["Not found in any lists or existing leads.", "Fresh lead, first contact pending."],
  new: ["Just came in from landing page."],
  booked: ["Appointment confirmed.", "Reminded customer a day before."],
  "not-eligible": ["Income does not meet minimum requirement.", "Existing blacklist match."],
  done: ["Loan disbursed successfully.", "Customer declined to proceed."],
};

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Nudges a date off Sunday (the only non-working day) onto Monday, same time of day. */
function avoidSunday(date: Date): Date {
  if (date.getDay() !== 0) return date;
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function weightedStatus(rng: () => number): LeadStatus {
  const total = STATUS_POOL.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng() * total;
  for (const entry of STATUS_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry.status;
  }
  return "assigned";
}

/** Simple deterministic PRNG (mulberry32) so a given seed always produces the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INCOME_DOCS: IncomeDocTag[] = ["cpf", "noa", "payslip", "bank-statement"];
const FOREIGNER_DOCS: ForeignerDocTag[] = ["por", "wp-over-3m"];
const MONTHLY_INCOMES = ["2,200", "2,800", "3,500", "4,000", "4,800", "5,500", "6,200", "7,000"];

function seedTags(rng: () => number, status: LeadStatus): LeadTags {
  if (status === "new" || rng() > 0.62) return emptyLeadTags();

  const docs = INCOME_DOCS.filter(() => rng() > 0.62);
  const residency = rng() > 0.22 ? "sg-pr" : "foreigner";
  const foreignerDocs = residency === "foreigner" ? FOREIGNER_DOCS.filter(() => rng() > 0.45) : [];

  return {
    residency,
    employment: rng() > 0.28 ? "employed" : "self-employed",
    incomeDocs: docs.length > 0 ? docs : rng() > 0.5 ? [pick(INCOME_DOCS, rng)] : [],
    foreignerDocs,
    outstanding: rng() > 0.45 ? { kind: "none" } : { kind: "amount", label: pick(AMOUNTS, rng) },
    monthlyIncome: rng() > 0.3 ? pick(MONTHLY_INCOMES, rng) : null,
  };
}

function seedEligibility(rng: () => number, status: LeadStatus): EligibilityTag | null {
  if (status === "new" && rng() > 0.35) return null;
  return pick(ELIGIBILITY_OPTIONS, rng).id;
}

function seedCloseReason(rng: () => number, status: LeadStatus): CloseReason | null {
  if (status !== "not-eligible") return null;
  return pick(CLOSE_REASON_ORDER, rng);
}

// Roughly mirrors the simulated 20 / 15 / 10 / 5 split shown on the Qualifying drill-down chips.
const QUALIFYING_REASON_POOL: { reason: QualifyingReason; weight: number }[] = [
  { reason: "no-reply", weight: 20 },
  { reason: "interest-rate-fees", weight: 15 },
  { reason: "bad-timing", weight: 10 },
  { reason: "didnt-book", weight: 5 },
];

function seedQualifyingReason(rng: () => number, status: LeadStatus): QualifyingReason | null {
  if (status !== "qualifying") return null;
  const total = QUALIFYING_REASON_POOL.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng() * total;
  for (const entry of QUALIFYING_REASON_POOL) {
    roll -= entry.weight;
    if (roll <= 0) return entry.reason;
  }
  return "no-reply";
}

interface TalkingPointScenario {
  painPoint: string;
  aiSuggestedReply: string;
}

const SCENARIOS_BY_REASON: Record<QualifyingReason, TalkingPointScenario[]> = {
  "no-reply": [
    {
      painPoint: "Gone quiet after the first call - hasn't replied to the last 2 follow-ups.",
      aiSuggestedReply: "Hi, just checking in - still keen on the loan? Happy to go through the numbers whenever suits you, even a quick 5 min call.",
    },
    {
      painPoint: "Read the WhatsApp message but hasn't replied - may be hesitant to commit.",
      aiSuggestedReply: "Hey, no rush at all - let me know if you have any questions about the offer, I'm here to help whenever you're ready.",
    },
  ],
  "interest-rate-fees": [
    {
      painPoint: "Thinks the interest rate is higher than what banks are offering.",
      aiSuggestedReply: "I hear you - our rate factors in same-day approval with no income proof needed. Want me to break down the total repayment so it's easy to compare?",
    },
    {
      painPoint: "Worried the processing fee eats into the amount he actually receives.",
      aiSuggestedReply: "Totally fair concern - the fee is a one-time 2% and it's already reflected in the amount I quoted, so there's no surprise deduction later.",
    },
  ],
  "bad-timing": [
    {
      painPoint: "Says it's not a good time right now - juggling other commitments.",
      aiSuggestedReply: "No worries - when would be a better time to check back in? I can also hold today's rate for a few more days if that helps.",
    },
    {
      painPoint: "Wants to wait until after payday before deciding.",
      aiSuggestedReply: "Makes sense - want me to set a reminder to follow up right after your payday so you don't lose the offer?",
    },
  ],
  "didnt-book": [
    {
      painPoint: "Agreed to proceed but hasn't picked an appointment slot yet.",
      aiSuggestedReply: "Great that you're keen! I've got a slot tomorrow at 2pm or Thursday at 11am - which works better for you?",
    },
    {
      painPoint: "Keeps postponing the booking call.",
      aiSuggestedReply: "Totally understand things get busy - it only takes 15 min. Would a call today after 6pm work instead?",
    },
  ],
};

const GENERIC_SCENARIOS: TalkingPointScenario[] = [
  {
    painPoint: "Hasn't confirmed if the quoted amount covers what he needs.",
    aiSuggestedReply: "Just to confirm - does the amount I quoted cover what you need, or should I check if we can go higher?",
  },
  {
    painPoint: "Comparing this offer against another lender before deciding.",
    aiSuggestedReply: "No problem taking your time to compare - want me to send a quick summary of our rate and fees so it's easy to line up side by side?",
  },
  {
    painPoint: "Unsure if his income documents are enough to qualify.",
    aiSuggestedReply: "Good question - a recent payslip and 3 months of CPF is usually enough. Want me to check with the assessor once you send them over?",
  },
];

function seedTalkingPoint(rng: () => number, status: LeadStatus, qualifyingReason: QualifyingReason | null): TalkingPointScenario | null {
  if (status === "qualifying" && qualifyingReason) {
    return pick(SCENARIOS_BY_REASON[qualifyingReason], rng);
  }
  if ((status === "assigned" || status === "no-response" || status === "pending-booking") && rng() > 0.35) {
    return pick(GENERIC_SCENARIOS, rng);
  }
  return null;
}

function formatPhone(rng: () => number): string {
  const prefix = rng() > 0.5 ? "8" : "9";
  const rest = String(Math.floor(rng() * 9000000) + 1000000);
  return `+65 ${prefix}${rest.slice(0, 3)} ${rest.slice(3)}`;
}

function makeNote(id: string, kind: NoteEntry["kind"], text: string, authorId: AgentId, createdAt: Date): NoteEntry {
  return { id, kind, text, authorId, createdAt: createdAt.toISOString() };
}

/**
 * Builds ~60 leads spread across Heryana, Willi, and Radah with realistic status mix and
 * follow-up times distributed across overdue / due-today / upcoming buckets.
 */
export function buildMockLeads(now: Date = new Date()): Lead[] {
  const rng = mulberry32(20260814);
  const leads: Lead[] = [];

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  NAMES.forEach((name, idx) => {
    const agent = AGENTS[idx % AGENTS.length];
    const status = weightedStatus(rng);
    const source = pick(SOURCES, rng);
    const createdAt = new Date(now.getTime() - Math.floor(rng() * 20 + 1) * 3600_000 * 24 * (rng() > 0.7 ? 3 : 1));
    const updatedAt = new Date(createdAt.getTime() + Math.floor(rng() * 20) * 3600_000);

    let followUpAt: string | null = null;
    let appointment: Lead["appointment"] = null;

    const needsFollowUp = status !== "done" && status !== "not-eligible";

    if (needsFollowUp) {
      const bucket = rng();
      let dueDate: Date;
      if (bucket < 0.32) {
        // overdue: 1-48 hours in the past
        dueDate = new Date(now.getTime() - Math.floor(rng() * 47 + 1) * 3600_000);
      } else if (bucket < 0.66) {
        // due today: somewhere between start of day and +8h from now
        const minutesIntoDay = Math.floor(rng() * (23 * 60));
        dueDate = new Date(startOfToday.getTime() + minutesIntoDay * 60_000);
      } else {
        // upcoming: 1-6 days ahead
        dueDate = avoidSunday(new Date(now.getTime() + Math.floor(rng() * 6 + 1) * 24 * 3600_000));
      }
      followUpAt = dueDate.toISOString();
    }

    if (status === "booked" || (status === "pending-booking" && rng() > 0.5)) {
      const apptDate = avoidSunday(new Date(now.getTime() + Math.floor(rng() * 10 - 2) * 24 * 3600_000));
      appointment = {
        id: `appt-${idx}`,
        dateISO: apptDate.toISOString().slice(0, 10),
        timeLabel: pick(["9:00 am", "10:30 am", "11:00 am", "1:30 pm", "2:30 pm", "4:00 pm", "5:30 pm"], rng),
        createdAt: updatedAt.toISOString(),
      };
    }

    const notes: NoteEntry[] = [];
    const templatePool = NOTE_TEMPLATES_BY_STATUS[status];
    if (templatePool && rng() > 0.15) {
      notes.push(
        makeNote(`note-${idx}-0`, "note", pick(templatePool, rng), agent.id, updatedAt)
      );
    }
    if (rng() > 0.7) {
      notes.push(
        makeNote(
          `note-${idx}-1`,
          "call",
          pick(["Called - no answer.", "Called - asked to call back later.", "Called - discussed loan terms."], rng),
          agent.id,
          new Date(updatedAt.getTime() - 3600_000)
        )
      );
    }

    const qualifyingReason = seedQualifyingReason(rng, status);
    const talkingPoint = seedTalkingPoint(rng, status, qualifyingReason);

    leads.push({
      id: `lead-${idx + 1}`,
      name,
      phone: formatPhone(rng),
      status,
      agentId: agent.id,
      source,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      followUpAt,
      appointment,
      notes,
      loanAmountLabel: rng() > 0.25 ? pick(AMOUNTS, rng) : null,
      tags: seedTags(rng, status),
      eligibility: seedEligibility(rng, status),
      qualifyingReason,
      painPoint: talkingPoint?.painPoint ?? null,
      aiSuggestedReply: talkingPoint?.aiSuggestedReply ?? null,
      closeReason: seedCloseReason(rng, status),
    });
  });

  return leads;
}
