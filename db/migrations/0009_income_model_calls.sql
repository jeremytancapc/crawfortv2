-- One row for every call to the document-reading model, whatever came of it.
--
-- income_readings only exists for a reading that was usable, so a refusal - the
-- replies most worth replaying - left a one-line event and nothing else. A
-- decision could not be explained afterwards, and re-running the model on the
-- stored files is not a replay: its answer can differ. This keeps the model's
-- raw report with the instructions and date it was made under, so the decision
-- can be made again from it.

create table income_model_calls (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Kept at least five years from the call. Nothing deletes these rows yet;
  -- this is the date a clean-up may start from once the retention rule is
  -- confirmed. The report holds names and amounts.
  retain_until  timestamptz not null default (now() + interval '5 years'),

  -- No foreign key, deliberately: this is a record of a decision about a
  -- person, and it must outlive their application row.
  applicant_id  uuid not null,
  -- The reading made from this call, when it was usable. Null for a refusal.
  reading_id    uuid,
  document_ids  uuid[] not null,

  -- How the reply was made.
  model_id        text not null,
  -- A short hash of the system prompt and tool schema in force (lib/prompt-version.ts).
  prompt_version  text not null,
  -- Why the model stopped: tool_use, max_tokens, end_turn ...
  stop_reason     text,
  -- { inputTokens, outputTokens }
  usage           jsonb,
  latency_ms      integer,

  -- The date the rules were run against, so a month window can be reproduced.
  read_today       date not null,
  employment_type  text,

  -- The model's report_income input exactly as it came back. Null when it made
  -- no such call.
  report          jsonb,

  -- What our code decided from it, and the sentence the applicant was shown.
  outcome_kind    text not null,
  outcome_reason  text
);

create index income_model_calls_applicant_idx on income_model_calls (applicant_id, created_at desc);
