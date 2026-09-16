-- Initial schema for the Crawfort loan application.
--
-- Squashed from the twenty incremental Supabase migrations that preceded the
-- in-memory store, then reconciled against CONTEXT.md and ADR-0001. Squashing
-- is safe because no database survived that removal: there is no deployed
-- history for a migration chain to line up with.
--
-- Deliberately dropped from those migrations:
--
--   1. Row-level security and all `service role` / `anon` policies. RLS
--      constrains a key handed to a browser. Nothing reaches this database
--      except server-side Route Handlers holding DATABASE_URL.
--   2. `appointments_slot_unique`, added then dropped once applicants were
--      allowed to hold the same slot.
--   3. The credit_rejection_reason backfill, which has no rows to act on.
--   4. The verbatim MyInfo columns on myinfo_profiles (myinfo_raw, cpf_raw,
--      noa_raw). See myinfo_retrievals below for where verbatim data lives
--      now, and for how long.
--
-- Names follow CONTEXT.md. The glossary insists the four amounts "must never
-- be collapsed into one", so each is spelled as the glossary spells it:
-- Desired Amount, Underwritten Cap, A-Card Limit, Maximum Loan Quantum.

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────

-- `in_progress` sorts before `new`: a partial applicant row is captured at the
-- MyInfo activate step (Singpass) or the review confirm (manual), and only
-- becomes `new` at final submit.
create type applicant_status as enum (
  'in_progress', 'new', 'contacted', 'qualified',
  'appointed', 'approved', 'rejected', 'withdrawn'
);

create type auth_method as enum ('manual', 'singpass', 'aip', 'axs');

create type id_type as enum ('singaporean', 'pr', 'foreigner');

create type bankruptcy_declaration as enum ('clear', 'discharged_lt5', 'active');

create type appointment_status as enum ('pending', 'confirmed', 'cancelled', 'completed');

create type income_source as enum ('cpf', 'noa', 'self_declared');

-- Ascend's verdict on an application. Distinct from Eligibility, which decides
-- whether an applicant may proceed through the funnel at all and is settled
-- before any credit decision.
create type risk_status as enum ('passed', 'pending', 'rejected');

-- ── Shared trigger ───────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── applicants ───────────────────────────────────────────────────────────

-- Named for the glossary's Applicant: a person progressing through the apply
-- funnel who has not yet signed an offer. Not `leads` - CONTEXT.md reserves
-- "lead" for what AirConnect owns, and explicitly lists it as a term to avoid
-- for this concept.
create table applicants (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Desired Amount: what the applicant asks for, collected at the start of
  -- the funnel before any verification. It is not an offer and not a cap.
  desired_amount              numeric(10,2) not null,
  loan_tenure                 smallint not null,
  loan_purpose                text,
  urgency                     text,

  -- Identity
  auth_method                 auth_method,
  id_type                     id_type,
  full_name                   text,
  nric                        text,

  -- Contact
  email                       text,
  mobile                      text,
  secondary_mobile            text,

  -- Address
  postal_code                 text,
  address                     text,
  mailing_address             text,

  -- Employment
  employment_status           text,
  monthly_income              text,
  work_industry               text,
  position                    text,
  employment_duration         text,
  office_phone                text,

  -- Declarations
  marital_status              text,
  bankruptcy_declaration      bankruptcy_declaration,
  moneylender_no_loans        boolean not null default false,
  moneylender_loan_amount     text,
  moneylender_payment_history text,

  -- CRM
  status                      applicant_status not null default 'new',
  notes                       text,
  assigned_to                 text,

  -- Survey reason for declining an offer that was made. NOT a credit
  -- rejection: see ascend_orders.risk_status for that.
  decline_reason              text,

  -- Eligibility, from the AirConnect check at submit. Whether the applicant
  -- may proceed at all - decided before any credit decision.
  eligibility_status          text,
  eligibility_notes           text,
  eligibility_reloan_reason   text,

  -- Selected offer
  selected_plan               text,
  plan_monthly_rate           numeric(6,4),
  plan_monthly_instalment     numeric(10,2)
);

create trigger applicants_updated_at
  before update on applicants
  for each row execute function set_updated_at();

create index applicants_status_idx     on applicants (status);
create index applicants_nric_idx       on applicants (nric);
create index applicants_email_idx      on applicants (email);
create index applicants_created_at_idx on applicants (created_at desc);

comment on column applicants.desired_amount is
  'Desired Amount (CONTEXT.md): what the applicant asked for. Never an offer.';

-- ── ascend_orders ────────────────────────────────────────────────────────

-- Ascend is the lending system of record and the final authority on what can
-- be borrowed (ADR-0001). Calling /openApi/apply/credit is not a quote - it
-- creates an order that signing and disbursement then consume.
--
-- `applicant_id` is UNIQUE, and that is the entire point of this table. The
-- ADR requires the credit call be made "once per applicant, guarded by a
-- persisted orderId". Enforcing that in application code loses the race
-- between two concurrent submits; enforcing it here means Postgres refuses
-- the second outright. The cost of losing that race is a duplicate credit
-- pull and a duplicate order against a real person.
create table ascend_orders (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  applicant_id          uuid not null references applicants (id) on delete cascade,

  -- Ascend's own identifier, returned by /openApi/apply/credit.
  order_id              text not null,

  risk_status           risk_status,

  -- A-Card Limit: what Ascend is willing to lend. The final authority, and
  -- the ceiling the applicant selects against.
  a_card_limit          numeric(10,2),

  -- Maximum Loan Quantum: the regulatory ceiling across all licensed
  -- moneylenders, reported by MLCB. Constrains the A-Card Limit but is not
  -- itself an offer.
  maximum_loan_quantum  numeric(10,2),

  -- Ascend reports this directly. A Reloan Customer leaves the web funnel, so
  -- this is read before any credit pull is spent.
  new_customer          boolean,

  constraint ascend_orders_applicant_unique unique (applicant_id)
);

create trigger ascend_orders_updated_at
  before update on ascend_orders
  for each row execute function set_updated_at();

create index ascend_orders_order_id_idx     on ascend_orders (order_id);
create index ascend_orders_risk_status_idx  on ascend_orders (risk_status);

comment on constraint ascend_orders_applicant_unique on ascend_orders is
  'ADR-0001: one credit call per applicant. This constraint is the guard.';

-- ── myinfo_profiles ──────────────────────────────────────────────────────

-- What we retained from a MyInfo retrieval, after mapping. There is no
-- verbatim copy here by design: the verbatim payload lives in
-- myinfo_retrievals and expires. See that table for the reasoning.
create table myinfo_profiles (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),

  applicant_id       uuid not null references applicants (id) on delete cascade,

  nric               text,
  full_name          text,
  email              text,
  mobile             text,
  address            text,
  postal_code        text,
  residential_status text,           -- raw code, e.g. "C", "P"
  monthly_income_noa numeric(12,2),  -- derived from NOA history

  -- Mapped CPF contributions, NOA history and date of birth - the inputs the
  -- income engine re-reads when scoring. Derived, not verbatim: this is what
  -- buildMyInfoPatch made of the payload, not what Singpass sent.
  processed_payload  jsonb not null default '{}'::jsonb,

  constraint myinfo_profiles_applicant_unique unique (applicant_id)
);

create index myinfo_profiles_applicant_id_idx on myinfo_profiles (applicant_id);
create index myinfo_profiles_nric_idx         on myinfo_profiles (nric);

-- ── myinfo_retrievals ────────────────────────────────────────────────────

-- The durable replacement for lib/auth-callback-store.ts.
--
-- The verbatim payload arrives at the Singpass callback, but the applicant
-- row is not created until the activate step that follows - so it cannot go
-- straight into myinfo_profiles, whose applicant_id is NOT NULL.
--
-- It previously lived in a module-level Map with a ten-minute TTL. That works
-- on one long-lived process and fails quietly on serverless: activate can
-- land on a different instance than the callback, and the raw columns then
-- write NULL while every mapped column succeeds. The failure is invisible
-- precisely because everything else populates.
--
-- These rows hold unminimised personal data - full NRIC, address, CPF and NOA
-- history. They exist only to bridge callback to activate, and `expires_at`
-- carries the retention deadline on the row itself rather than leaving it to
-- a forgotten cron argument.
create table myinfo_retrievals (
  -- The key handed to the session as `singpassRawKey`. The payload itself
  -- never travels in the session: it is far larger than a cookie can hold.
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- Verbatim, exactly as Singpass returned it. Never edited in place: this is
  -- the record of what was received, not what we made of it.
  payload      jsonb not null,

  applicant_id uuid references applicants (id) on delete set null,
  consumed_at  timestamptz,

  expires_at   timestamptz not null default now() + interval '24 hours'
);

create index myinfo_retrievals_applicant_id_idx on myinfo_retrievals (applicant_id) where applicant_id is not null;
create index myinfo_retrievals_expires_at_idx   on myinfo_retrievals (expires_at);

comment on table myinfo_retrievals is
  'Short-lived verbatim MyInfo payloads bridging callback to activate. Unminimised PII; prune past expires_at.';

-- ── appointments ─────────────────────────────────────────────────────────

create table appointments (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  applicant_id        uuid not null references applicants (id) on delete cascade,

  appointment_date    date not null,
  appointment_time    time not null,

  status              appointment_status not null default 'pending',
  notes               text,
  reminder_sent_at    timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text
);

create trigger appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

create index appointments_applicant_id_idx on appointments (applicant_id);
create index appointments_date_time_idx    on appointments (appointment_date, appointment_time);
create index appointments_status_idx       on appointments (status);

-- ── credit_assessments ───────────────────────────────────────────────────

-- Our own income engine's output. Since ADR-0001 this decides nothing: Ascend
-- owns the borrowable amount. The engine keeps running so its numbers can be
-- compared against Ascend's in production - that comparison is the reason the
-- table still exists.
create table credit_assessments (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  applicant_id                uuid not null references applicants (id) on delete cascade,

  income_source               income_source not null,
  verified_monthly_income     numeric(12,2) not null,

  -- Underwritten Cap: the ceiling our income engine derives from CPF, NOA or
  -- declared income. Retained for analytics and comparison against the A-Card
  -- Limit; it does not decide what the applicant is offered.
  underwritten_cap            numeric(10,2) not null,

  -- The engine's own offer figure. Named for what it is rather than
  -- "approved_loan_amount", which reads like a sum someone may pay out. Since
  -- ADR-0001 nobody is approved for this number.
  engine_offer_amount         numeric(10,2) not null,

  -- The engine's own pass/fail. Not Eligibility (which is decided earlier,
  -- from the AirConnect check) and not Risk Status (which is Ascend's).
  is_eligible                 boolean not null,

  age_at_application          smallint,
  existing_loans              numeric(10,2) not null default 0,

  -- Audit only. The declared moneylender balance is recorded but is not
  -- deducted from the cap.
  moneylender_loan_amount     numeric(10,2),
  moneylender_payment_history text,

  explanation                 text,
  credit_rejection_reason     text,

  raw_assessment              jsonb not null default '{}'::jsonb,

  constraint credit_assessments_applicant_unique unique (applicant_id)
);

create index credit_assessments_applicant_id_idx on credit_assessments (applicant_id);

comment on column credit_assessments.underwritten_cap is
  'Underwritten Cap (CONTEXT.md). Comparison figure only since ADR-0001.';
comment on column credit_assessments.engine_offer_amount is
  'The local engine''s offer figure. NOT an approved amount - Ascend decides.';
comment on column credit_assessments.credit_rejection_reason is
  'System decline code when is_eligible=false: under_18, foreigner_income_floor, zero_cap_moneylender_os, zero_cap_income_too_low. NULL when the engine passed.';

-- ── apply_flow_events ────────────────────────────────────────────────────

-- Funnel diagnostics. Identifiers are stored as last-4 only; a full NRIC or
-- mobile number must never land in this table.
create table apply_flow_events (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  trace_id                    uuid not null,
  event                       text not null,
  environment                 text,
  vercel_deployment_id        text,

  singpass_raw_key            uuid,
  apply_trace_id              uuid,

  mobile_last4                text,
  nric_last4                  text,

  had_existing_session_cookie boolean not null default false,
  had_activate_token          boolean not null default false,
  token_decode_ok             boolean,
  had_apply_gate_cookie       boolean,

  cookie_existing_bytes       integer,
  cookie_token_bytes          integer,
  cookie_merged_bytes         integer,
  cookie_may_exceed_4kb       boolean,

  resume_would_pass           boolean,

  user_agent                  text,
  referer                     text,
  request_path                text,

  details                     jsonb not null default '{}'::jsonb
);

create index apply_flow_events_created_at_idx on apply_flow_events (created_at desc);
create index apply_flow_events_trace_id_idx   on apply_flow_events (trace_id, created_at);

create index apply_flow_events_singpass_raw_key_idx
  on apply_flow_events (singpass_raw_key) where singpass_raw_key is not null;
create index apply_flow_events_apply_trace_id_idx
  on apply_flow_events (apply_trace_id) where apply_trace_id is not null;
create index apply_flow_events_mobile_last4_idx
  on apply_flow_events (mobile_last4, created_at desc) where mobile_last4 is not null;
create index apply_flow_events_nric_last4_idx
  on apply_flow_events (nric_last4, created_at desc) where nric_last4 is not null;

-- ── api_logs ─────────────────────────────────────────────────────────────

-- Every outbound HTTP call, for debugging. applicant_id is intentionally not
-- a foreign key: a log line must survive its applicant being deleted.
create table api_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  tag             text not null,
  method          text not null,
  url             text not null,
  request_headers jsonb not null default '{}',
  request_body    jsonb,
  response_status integer,
  response_ok     boolean,
  response_body   text,
  duration_ms     integer,
  applicant_id    uuid,
  error           text
);

create index api_logs_applicant_id_idx on api_logs (applicant_id);
create index api_logs_created_at_idx   on api_logs (created_at desc);

-- ── Reporting ────────────────────────────────────────────────────────────

create or replace view applicant_assessment_report as
select
  (a.created_at at time zone 'Asia/Singapore')::timestamp as created_at_sgt,
  a.full_name,
  a.mobile,
  a.nric,
  'CFH5-' || upper(right(replace(a.id::text, '-', ''), 8)) as ref,

  -- Outcome is Ascend's when there is an order, and falls back to the local
  -- engine only for applicants who never reached a credit call.
  coalesce(ao.risk_status::text, case when ca.is_eligible then 'passed' else 'rejected' end) as outcome,

  case ca.income_source::text
    when 'cpf'           then 'CPF'
    when 'noa'           then 'NOA'
    when 'self_declared' then 'Self-declared'
  end as income_derived_from,

  ca.credit_rejection_reason,
  case ca.credit_rejection_reason
    when 'under_18'                 then 'Under 18'
    when 'foreigner_income_floor'   then 'Foreigner income below minimum'
    when 'zero_cap_moneylender_os'  then 'Cap zero — moneylender O/S'
    when 'zero_cap_income_too_low'  then 'Cap zero — income too low'
    else null
  end as credit_rejection_label,

  a.decline_reason as offer_decline_reason,

  a.desired_amount,
  ao.a_card_limit,
  ao.maximum_loan_quantum,
  ao.new_customer,
  ca.underwritten_cap,
  ca.engine_offer_amount,
  ca.verified_monthly_income,
  ca.existing_loans as moneylender_os,
  a.auth_method::text as auth_method,
  a.id_type::text as id_type,
  ca.is_eligible as engine_passed,
  app.appointment_date,
  to_char(app.appointment_time, 'HH24:MI') as appt_time_sgt,
  (app.appointment_date is not null) as has_booking,
  ca.explanation

from applicants a
left join credit_assessments ca on a.id = ca.applicant_id
left join ascend_orders      ao on a.id = ao.applicant_id
left join lateral (
  select ap.appointment_date, ap.appointment_time
  from appointments ap
  where ap.applicant_id = a.id
  order by ap.created_at desc
  limit 1
) app on true;

comment on view applicant_assessment_report is
  'Reporting. outcome prefers Ascend Risk Status; offer_decline_reason is the applicant survey on an offer that was made.';
