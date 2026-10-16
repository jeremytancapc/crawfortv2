-- Reporting views, fourth version: why a submitted applicant has no Ascend order.
--
-- "Submitted, no Ascend order" was one pile. It has five different causes, and
-- only some are urgent (Ascend not configured in production, a failed call, an
-- order Ascend made that we did not save). The log says which.

-- One row per applicant, with the stage they reached.
--
-- Changed from 0012: no_order_reason and no_order_detail say why an applicant who
-- submitted has no Ascend order, from what the call log recorded.
--
-- Changed from 0011: an applicant Ascend says is an existing customer is sent to
-- the app on purpose and never gets an order, so they are
-- `existing_customer_redirected`, not a fault; and `needs_follow_up` is added.
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
ascend_calls as (
  -- What the call log says about each applicant's dealings with Ascend. The
  -- shape records and the 'skipped' marker are included; shape alerts are not
  -- a call.
  select applicant_id,
         bool_or(tag = '[ascend]skipped')                                              as skipped,
         bool_or(tag like '[ascend]/openApi/%' and response_ok is false)                as failed,
         bool_or(tag = '[ascend]/openApi/apply/credit' and response_ok is true)         as credit_ok,
         (array_agg(coalesce(error, left(response_body, 100)) order by created_at desc)
            filter (where tag = '[ascend]skipped' or (tag like '[ascend]/openApi/%' and response_ok is false)))[1] as problem
  from api_logs
  where tag like '[ascend]%' and tag <> '[ascend-shape]' and applicant_id is not null
  group by applicant_id
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
    a.ascend_user_id                          as ascend_user_id,
    ac.skipped, ac.failed, ac.credit_ok, ac.problem,
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
      when a.status <> 'in_progress' and a.ascend_new_customer = false    then 'existing_customer_redirected'
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
  left join ascend_calls ac        on ac.applicant_id = a.id
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
  o.stage_order,
  -- True for everyone a person should look at. Booked and declined are finished,
  -- and an existing customer was sent to the app on purpose. The report filters
  -- on this one field, so a stage added later needs no change in Data Studio.
  (s.stage not in ('booked', 'declined_offer', 'existing_customer_redirected')) as needs_follow_up,
  -- Why an applicant who submitted has no Ascend order. Only for that stage.
  -- None of these is the applicant's doing: they pressed Submit and were told
  -- their application is under review.
  case when s.stage = 'submitted_no_ascend_order' then
    case
      when coalesce(s.skipped, false)                       then 'ascend_not_configured'
      when coalesce(s.failed, false)                        then 'ascend_call_failed'
      when coalesce(s.credit_ok, false)                     then 'order_not_saved'
      when s.ascend_user_id is not null                     then 'user_made_no_credit_call'
      else                                                       'no_call_recorded'
    end
  end as no_order_reason,
  case when s.stage = 'submitted_no_ascend_order' then s.problem end as no_order_detail
from staged s
join (values
  ('started_not_logged_in',          1),
  ('logged_in_not_submitted',        2),
  ('existing_customer_redirected',   3),
  ('submitted_no_ascend_order',      4),
  ('needs_income_not_started',       5),
  ('uploading_income_not_submitted', 6),
  ('waiting_for_staff_review',       7),
  ('approved_without_limit',         8),
  ('rejected_by_ascend',             9),
  ('offer_seen_no_plan',            10),
  ('plan_chosen_not_booked',        11),
  ('booking_cancelled',             12),
  ('declined_offer',                13),
  ('booked',                        14)
) as o(stage, stage_order) on o.stage = s.stage;

-- Never completed: everyone who needs a person to look at them, and the stage
-- they stopped at. no_order_reason / no_order_detail are appended (a replaced
-- view may only add columns at the end).
create or replace view reporting.stuck as
select ref, created_at, last_activity_at, hours_since_last_activity, mobile,
       stage, apply, source, requested, income, ascend_result, approved,
       documents, last_income_issue, selected_plan, id,
       no_order_reason, no_order_detail
from reporting.applicant_journey
where needs_follow_up;
