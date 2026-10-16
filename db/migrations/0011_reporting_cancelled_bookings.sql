-- Reporting views, second version: a cancelled booking is not a booking.
--
-- Replaces reporting.applicant_journey only (create or replace, same columns).
-- reporting.booked, customer_declined, stuck and stage_summary read from it and
-- need no change: booked now excludes cancelled ones, and stuck includes them.

-- One row per applicant, with the stage they reached.
--
-- Changed from 0010: an appointment that was cancelled no longer counts as
-- booked. The latest appointment is the one that counts, so someone who cancelled
-- and booked again is booked, and someone who only cancelled is
-- `booking_cancelled` - a person to call.
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
      when ap.applicant_id is not null and ap.status <> 'cancelled'       then 'booked'
      when a.decline_reason is not null                                   then 'declined_offer'
      when ap.applicant_id is not null                                    then 'booking_cancelled'
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
  ('booking_cancelled',             11),
  ('declined_offer',                12),
  ('booked',                        13)
) as o(stage, stage_order) on o.stage = s.stage;
