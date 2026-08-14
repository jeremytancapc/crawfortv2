/**
 * Seeded mock data for AirConnect - the call-centre agent CRM.
 * Client-only: generated with Date.now()/Math.random(), so this must never be
 * evaluated during SSR (see app/airconnect/airconnect-loader.tsx, which loads
 * the workspace with ssr: false to avoid hydration mismatches).
 */

import type { Agent, AgentId, Lead, LeadSource, LeadStatus, NoteEntry } from "./types";

export const AGENTS: Agent[] = [
  { id: "agent-a", name: "Agent A", initials: "AA", colorHex: "#0033AA" },
  { id: "agent-b", name: "Agent B", initials: "AB", colorHex: "#0F9D8A" },
  { id: "agent-c", name: "Agent C", initials: "AC", colorHex: "#B45309" },
];

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

function formatPhone(rng: () => number): string {
  const prefix = rng() > 0.5 ? "8" : "9";
  const rest = String(Math.floor(rng() * 9000000) + 1000000);
  return `+65 ${prefix}${rest.slice(0, 3)} ${rest.slice(3)}`;
}

function makeNote(id: string, kind: NoteEntry["kind"], text: string, authorId: AgentId, createdAt: Date): NoteEntry {
  return { id, kind, text, authorId, createdAt: createdAt.toISOString() };
}

/**
 * Builds ~60 leads spread across Agents A, B, C with realistic status mix and
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
        dueDate = new Date(now.getTime() + Math.floor(rng() * 6 + 1) * 24 * 3600_000);
      }
      followUpAt = dueDate.toISOString();
    }

    if (status === "booked" || (status === "pending-booking" && rng() > 0.5)) {
      const apptDate = new Date(now.getTime() + Math.floor(rng() * 10 - 2) * 24 * 3600_000);
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
    });
  });

  return leads;
}
