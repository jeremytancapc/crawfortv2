-- One row for every run of the income agent in shadow mode.
--
-- The agent decides what to do with an applicant's income documents alongside
-- the rules (lib/income-agent.ts) and is never shown to the applicant. This is
-- where its decision is kept next to the rules' own, so the two can be compared
-- on real submissions before the agent is given any say.

create table income_agent_runs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- The decision holds names. A year is long enough to judge whether the agent
  -- is better than the rules; a clean-up may start from this date.
  retain_until  timestamptz not null default (now() + interval '1 year'),

  -- No foreign key, as income_model_calls: a record about a person outlives
  -- their application row.
  applicant_id  uuid not null,
  document_ids  uuid[] not null,

  -- What the live rules decided on the same documents, and their reason.
  rule_kind     text not null,
  rule_reason   text,

  -- AgentDecision: { outcome, reasonCodes, customerMessage, evidence }. Null
  -- when the agent never decided; see stop_reason and error.
  decision      jsonb,
  -- True when the agent and the rules send the applicant the same way. Null
  -- when there is no decision.
  agrees        boolean,

  turns         integer not null,
  tool_calls    text[] not null default '{}',
  stop_reason   text,
  usage         jsonb,
  latency_ms    integer,
  error         text,

  model_id        text not null,
  prompt_version  text not null,
  read_today      date not null,
  employment_type text
);

create index income_agent_runs_applicant_idx on income_agent_runs (applicant_id, created_at desc);
create index income_agent_runs_disagree_idx on income_agent_runs (created_at desc) where agrees is false;
