-- Why Ascend left an application pending, and a stage for the ones income cannot fix.
--
-- Until now the sheet called every pending applicant `needs_income_not_started` (or one
-- of the two income stages after it), because the view only looked at Ascend's status
-- and at whether documents existed. Ascend also leaves applications pending for debt
-- ("15-MLCB High Debt") and for a small remaining quantum ("Low Balance Loan Quantum"),
-- which no payslip clears. Staff were told to chase income that would change nothing.
--
-- Ascend has not rejected these applicants: its order is still pending. So the sheet
-- shows the reason and lets the agent decide; it never says "rejected".
--
--   ascend_orders.risk_message   Ascend's riskMsg from the latest answer, verbatim. It was
--                                only ever in api_logs. Filled below for existing orders
--                                from the latest credit answer in that log.
--   stage pending_ascend_read_reason    pending, with a reason that does not name income. A reason
--                                that names income - alone or beside a debt reason - stays in
--                                the income stages. No stored reason: the old behaviour.
--   ascend_reason                the reason, at the end of applicant_journey and
--                                sheet_worklist (a view can only gain columns there). On the
--                                sheet it is empty unless the answer is pending.
--   no_order_reason              `user_made_no_credit_call` is renamed `ascend_answer_not_saved`.
--                                It said the credit call was never made; two applicants
--                                (3 Nov) had Ascend orders our app never recorded.
--
-- The views are recreated, the column and backfill are guarded: safe to re-run.

alter table ascend_orders add column if not exists risk_message text;

comment on column ascend_orders.risk_message is
  'Ascend riskMsg from the latest answer, verbatim (e.g. "15-MLCB High Debt"). Null when Ascend gave none.';

-- The latest answer decides, so an order re-scored after income shows the new reason
-- or none. Only a message found in the log is written; nothing is overwritten with null.
update ascend_orders o
set risk_message = x.msg
from (
  select distinct on (applicant_id)
         applicant_id,
         substring(response_body from '"riskMsg":"([^"]*)"') as msg
  from api_logs
  where applicant_id is not null
    and response_ok is true
    and tag in ('[ascend]/openApi/apply/credit', '[ascend]/openApi/income/credit', '[ascend]/openApi/query/credit')
  order by applicant_id, created_at desc
) x
where x.applicant_id = o.applicant_id
  and x.msg is not null
  and o.risk_message is null;

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
latest_submitted_reading as (
  -- What Ascend was last given as income: the most recent set of documents the
  -- applicant submitted. A reading that was made and never submitted is not it.
  select distinct on (applicant_id) applicant_id, average, income_type
  from income_readings
  where submitted_at is not null
  order by applicant_id, submitted_at desc
),
submitted_kinds as (
  -- What kinds of file were sent. Removed and merely uploaded files are not.
  select applicant_id, string_agg(distinct kind::text, ', ' order by kind::text) as kinds
  from income_documents
  where status = 'submitted' and kind is not null
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
    o.risk_message                            as ascend_reason,
    o.a_card_limit                            as approved,
    o.maximum_loan_quantum                    as max_eligible,
    ap.appointment_date                       as booking_date,
    ap.appointment_time                       as booking_time,
    coalesce(d.documents, 0)                  as documents,
    lsr.average                               as submitted_income,
    lsr.income_type                           as submitted_income_type,
    sk.kinds                                  as submitted_document_kinds,
    a.ascend_user_id                          as ascend_user_id,
    a.ascend_new_customer                     as ascend_new_customer,
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
      -- Pending for a reason income cannot clear (debt, loan quantum): Ascend's own
      -- words decide this, not whether documents were uploaded. A reason that names
      -- income - alone or beside a debt reason - stays with the income stages below,
      -- and a pending order with no reason stored is treated as before.
      when o.risk_status = 'pending'
           and coalesce(btrim(o.risk_message), '') <> ''
           and o.risk_message !~* 'income'                                 then 'pending_ascend_read_reason'
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
  left join latest_submitted_reading lsr on lsr.applicant_id = a.id
  left join submitted_kinds sk     on sk.applicant_id = a.id
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
      when s.ascend_user_id is not null                     then 'ascend_answer_not_saved'
      else                                                       'no_call_recorded'
    end
  end as no_order_reason,
  case when s.stage = 'submitted_no_ascend_order' then s.problem end as no_order_detail,
  -- The four piles the report is read in, one filter each:
  --   booked           has an appointment
  --   reloan           Ascend says they already borrow from us (sent to the app on purpose)
  --   got_credit_limit Ascend gave a limit and they did not book: chose a plan, saw the
  --                    offer, turned it down, or booked and cancelled
  --   other            no limit was ever given, whatever the reason: see `stage`
  case
    when s.stage = 'booked'                         then 'booked'
    -- Sent to the app on purpose, so no order. An applicant flagged as an existing
    -- customer who nevertheless went through the funnel and has an order is not one.
    when s.stage = 'existing_customer_redirected'   then 'reloan'
    -- A limit counts only while Ascend's current answer is a pass: one stored from an
    -- earlier answer, on an order since rejected, is not a limit they have.
    when s.ascend_result = 'passed' and coalesce(s.approved, 0) > 0 then 'got_credit_limit'
    else                                                 'other'
  end as journey_group,
  -- Added in 0016, at the end.
  s.submitted_income,
  s.submitted_income_type,
  s.submitted_document_kinds,
  coalesce(s.submitted_income, s.income)                                       as income_used,
  case when s.submitted_income is not null then s.submitted_income_type
       else upper(replace(s.source, '_', '-')) end                             as income_used_source,
  -- Added in 0022, at the end. Ascend's riskMsg for a pending answer, verbatim.
  s.ascend_reason
from staged s
join (values
  ('started_not_logged_in',          1),
  ('logged_in_not_submitted',        2),
  ('existing_customer_redirected',   3),
  ('submitted_no_ascend_order',      4),
  ('needs_income_not_started',       5),
  ('uploading_income_not_submitted', 6),
  ('waiting_for_staff_review',       7),
  ('pending_ascend_read_reason',      8),
  ('approved_without_limit',         9),
  ('rejected_by_ascend',            10),
  ('offer_seen_no_plan',            11),
  ('plan_chosen_not_booked',        12),
  ('booking_cancelled',             13),
  ('declined_offer',                14),
  ('booked',                        15)
) as o(stage, stage_order) on o.stage = s.stage;

create or replace view reporting.sheet_worklist as
select
  to_char(j.created_at, 'YYYY-MM-DD HH24:MI')                       as created_sgt,
  j.ref,
  j.apply                                                           as applied_via,
  j.journey_group                                                   as pile,
  j.stage,
  case when j.needs_follow_up then 'Yes' else 'No' end              as needs_follow_up,
  j.hours_since_last_activity,
  to_char(j.last_activity_at, 'YYYY-MM-DD HH24:MI')                 as last_activity_sgt,
  coalesce(j.ascend_result, '')                                     as ascend_result,
  coalesce(j.selected_plan, '')                                     as plan_chosen,
  -- A fixed list of choices on the offer screen, never free text.
  coalesce(j.decline_reason, '')                                    as decline_reason,
  coalesce(to_char(j.booking_date, 'YYYY-MM-DD') || ' ' || left(j.booking_time::text, 5), '') as booking_sgt,
  j.documents                                                       as documents_uploaded,
  -- The sentence the applicant was shown when a document was refused (no name: 0007).
  coalesce(j.last_income_issue, '')                                 as last_document_issue,
  -- A code only. no_order_detail is left out: it is raw API text.
  coalesce(j.no_order_reason, '')                                   as no_order_reason,
  coalesce(to_char(a.airconnect_lead_pushed_at at time zone 'Asia/Singapore', 'YYYY-MM-DD HH24:MI'), '') as sent_to_airconnect_sgt,
  j.created_at,
  j.booking_date,
  -- Added in 0020, at the end.
  coalesce(j.mobile, '')                                            as mobile,
  -- A limit counts only while Ascend's current answer is a pass. One stored from
  -- an earlier answer, on an order since rejected, is not a limit they have -
  -- the same rule `journey_group` uses, so the sheet and the piles agree.
  case when j.ascend_result = 'passed' then j.approved end          as acard_limit,
  j.max_eligible                                                    as max_loan_quantum,
  -- Added in 0021, at the end.
  -- The Desired Amount, but the app overwrites it with the amount the applicant
  -- draws once they choose a plan (select-plan: setDesiredAmount), so from then
  -- on it is their choice, not what they first asked for.
  j.requested                                                       as requested,
  -- What Ascend was last given as monthly income, and Ascend's own label for it:
  -- the submitted documents when there are any, otherwise the MyInfo figure.
  j.income_used                                                     as income,
  coalesce(j.income_used_source, '')                                as income_type,
  -- In months. Like `requested`, replaced by the plan's tenure once one is chosen.
  a.loan_tenure || case when a.loan_tenure = 1 then ' month' else ' months' end as loan_tenure,
  -- Added in 0022, at the end. What Ascend said when it left the application pending
  -- ("15-MLCB High Debt", "Low Balance Loan Quantum", ...), in its own words, so the
  -- agent can decide. Empty when Ascend gave no reason or the answer is not pending.
  case when j.ascend_result = 'pending' then coalesce(j.ascend_reason, '') else '' end as ascend_reason
from reporting.applicant_journey j
join applicants a on a.id = j.id;

comment on view reporting.sheet_worklist is
  'Applicants for the Google Sheet worklist. Carries the mobile number, amounts, income and Ascend''s pending reason since 0020-0022: the sheet holding it must be restricted to named staff.';
