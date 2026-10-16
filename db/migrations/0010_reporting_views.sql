-- Views for the Data Studio report: where each applicant got to, and where
-- they stopped.
--
-- Everything lives in its own schema, `reporting`. The report connects with a
-- read-only role that can read these views and nothing else (see
-- docs/data-studio-report.md), so it never touches the real tables. These
-- views hold no name, NRIC, email or address: only what staff need to follow
-- an applicant up (the mobile number) and the figures.
--
-- Views only, no data of their own, so this is safe to run and to re-run
-- (create or replace).

create schema if not exists reporting;

-- One row per applicant, with the stage they reached.
--
-- `stage` is the furthest real thing the data shows, checked from the end of
-- the journey back to the start, so someone who booked is "booked" whatever
-- else is also true of them.
create or replace view reporting.applicant_journey as
with latest_income_issue as (
  -- The most recent time the document reader refused or could not use what an
  -- applicant uploaded, and why. The sentence is the one the applicant saw.
  select distinct on (applicant_id) applicant_id, outcome_reason
  from income_model_calls
  where outcome_kind <> 'usable' and outcome_reason is not null
  order by applicant_id, created_at desc
),
documents as (
  select applicant_id, count(*) filter (where status in ('uploaded', 'read', 'submitted')) as documents
  from income_documents
  group by applicant_id
),
income_submitted as (
  select applicant_id, bool_or(submitted_at is not null) as submitted
  from income_readings
  group by applicant_id
),
latest_appointment as (
  select distinct on (applicant_id) applicant_id, appointment_date, appointment_time, status
  from appointments
  order by applicant_id, created_at desc
),
staged as (
  select
    a.id,
    a.created_at,
    a.updated_at,
    a.mobile,
    a.auth_method::text                       as apply,
    a.desired_amount                          as requested,
    a.employment_status,
    a.selected_plan,
    a.decline_reason,
    a.status::text                            as applicant_status,
    c.income_source::text                     as source,
    c.verified_monthly_income                 as income,
    c.existing_loans                          as outstanding,
    o.risk_status::text                       as ascend_result,
    o.a_card_limit                            as approved,
    o.maximum_loan_quantum                    as max_eligible,
    ap.appointment_date                       as booking_date,
    ap.appointment_time                       as booking_time,
    coalesce(d.documents, 0)                  as documents,
    li.outcome_reason                         as last_income_issue,
    case
      when ap.applicant_id is not null                                    then 'booked'
      when a.decline_reason is not null                                   then 'declined_offer'
      when a.selected_plan is not null                                    then 'plan_chosen_not_booked'
      when o.risk_status = 'passed' and coalesce(o.a_card_limit, 0) > 0   then 'offer_seen_no_plan'
      when o.risk_status = 'passed'                                       then 'approved_without_limit'
      when o.risk_status = 'rejected'                                     then 'rejected_by_ascend'
      when o.risk_status = 'pending' and coalesce(i.submitted, false)     then 'waiting_for_staff_review'
      when o.risk_status = 'pending' and coalesce(d.documents, 0) > 0     then 'uploading_income_not_submitted'
      when o.risk_status = 'pending'                                      then 'needs_income_not_started'
      when a.status <> 'in_progress'                                      then 'submitted_no_ascend_order'
      when a.auth_method = 'singpass'                                     then 'logged_in_not_submitted'
      else                                                                     'started_not_logged_in'
    end                                       as stage
  from applicants a
  left join credit_assessments c   on c.applicant_id  = a.id
  left join ascend_orders o        on o.applicant_id  = a.id
  left join latest_appointment ap  on ap.applicant_id = a.id
  left join documents d            on d.applicant_id  = a.id
  left join income_submitted i     on i.applicant_id  = a.id
  left join latest_income_issue li on li.applicant_id = a.id
)
select
  s.id,
  'CFH5-' || upper(right(s.id::text, 8))                          as ref,
  (s.created_at at time zone 'Asia/Singapore')                    as created_at,
  (s.updated_at at time zone 'Asia/Singapore')                    as last_activity_at,
  round(extract(epoch from (now() - s.updated_at)) / 3600)::int   as hours_since_last_activity,
  s.mobile,
  s.apply,
  upper(replace(s.source, '_', '-'))                              as source,
  s.income,
  s.requested,
  s.outstanding                                                   as os,
  s.max_eligible,
  s.approved,
  s.ascend_result,
  s.selected_plan,
  s.decline_reason,
  s.booking_date,
  s.booking_time,
  s.documents,
  s.last_income_issue,
  s.stage,
  o.stage_order
from staged s
join (values
  ('started_not_logged_in',          1),
  ('logged_in_not_submitted',        2),
  ('submitted_no_ascend_order',      3),
  ('needs_income_not_started',       4),
  ('uploading_income_not_submitted', 5),
  ('waiting_for_staff_review',       6),
  ('approved_without_limit',         7),
  ('rejected_by_ascend',             8),
  ('offer_seen_no_plan',             9),
  ('plan_chosen_not_booked',        10),
  ('declined_offer',                11),
  ('booked',                        12)
) as o(stage, stage_order) on o.stage = s.stage;

-- Booked: the appointments table in the report.
create or replace view reporting.booked as
select ref, created_at, mobile, booking_date, booking_time, apply, source,
       income, requested, os, max_eligible, approved, selected_plan, id
from reporting.applicant_journey
where stage = 'booked';

-- Customers who were shown an offer and turned it down, with their reason.
create or replace view reporting.customer_declined as
select ref, created_at, mobile, apply, source, decline_reason,
       income, requested, os, max_eligible, approved, id
from reporting.applicant_journey
where stage = 'declined_offer';

-- Never completed: everyone who neither booked nor turned an offer down, and
-- the stage they stopped at. Oldest activity first within a stage, so the
-- people who have waited longest are at the top.
create or replace view reporting.stuck as
select ref, created_at, last_activity_at, hours_since_last_activity, mobile,
       stage, apply, source, requested, income, ascend_result, approved,
       documents, last_income_issue, selected_plan, id
from reporting.applicant_journey
where stage not in ('booked', 'declined_offer');

-- Applicants per stage per day, for the funnel chart.
create or replace view reporting.stage_summary as
select (created_at)::date as day, stage, stage_order, count(*)::int as applicants
from reporting.applicant_journey
group by 1, 2, 3;
