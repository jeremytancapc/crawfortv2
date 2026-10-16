# Data Studio report: where applicants get stuck

A Looker Studio (Data Studio) report with the same three tables as the CF H5
report, plus a funnel: **Booked**, **Customer rejected** and **Never completed**,
where "never completed" says *which step* each person stopped at.

It reads database **views** in a `reporting` schema (migration
`db/migrations/0010_reporting_views.sql`) through a **read-only database role**.
The report never touches the real tables, and the views hold no name, NRIC,
email or address - only the mobile number staff need to follow someone up.

## The tables, and where each comes from

| Report table | View | Who is in it |
|---|---|---|
| Booked | `reporting.booked` | Has an appointment: booking date and time, source (CPF / NOA / SELF-DECLARED), income, requested, outstanding (OS), max eligible, approved |
| Customer rejected | `reporting.customer_declined` | Was shown an offer and turned it down, with the reason they gave |
| Never completed | `reporting.stuck` | Everyone else, with the **stage** they stopped at, the hours since they last did anything, and the last problem with their documents |
| Funnel chart | `reporting.stage_summary` | Applicants per stage per day |

Column meanings: **Max eligible** is Ascend's maximum loan quantum (the MLCB
ceiling); **Approved** is Ascend's credit limit (the A-Card Limit); **OS** is the
outstanding loans we recorded. **Ref** is `CFH5-` plus the last 8 characters of the
applicant id, the same reference staff already use.

## The stages ("where did they stop")

Checked from the end of the journey backwards, so someone who booked is "booked"
whatever else is true of them. `stuck` shows every stage except the first two.

| Stage | What it means | What to do |
|---|---|---|
| `booked` | Has an appointment | - |
| `declined_offer` | Saw the offer and said no (reason recorded) | Read the reason; follow up if it is a rate or amount concern |
| `plan_chosen_not_booked` | Picked a plan, never booked | Call: they are one step from done |
| `offer_seen_no_plan` | Approved and shown a limit, chose nothing | Call |
| `approved_without_limit` | Ascend said PASS but gave no limit | **A fault**, not a customer choice: check the order |
| `rejected_by_ascend` | Ascend rejected | Nothing, unless the reason looks wrong |
| `waiting_for_staff_review` | Income submitted, Ascend left it pending | **Staff are the blocker**: review the order |
| `uploading_income_not_submitted` | Uploaded documents, never submitted | Call; `last_income_issue` says why a document was refused |
| `needs_income_not_started` | Ascend wants income, none uploaded | Call: the document step lost them |
| `submitted_no_ascend_order` | Submitted, but Ascend never opened an order | **A fault**: check the Ascend call |
| `logged_in_not_submitted` | Logged in with Singpass, stopped at the review page | Call |
| `started_not_logged_in` | Row exists, never logged in | Low value |

`last_income_issue` is the sentence the applicant saw when we refused a document
(wrong name, month too old, and so on), taken from the latest refused reading.

## Setting it up

1. **Create the views** (the database owner runs this, once, on production):

   ```bash
   node scripts/db-migrate.mjs
   ```

   with the production `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set, as for any migration. It only creates views.

2. **Create the read-only role.** Run as the owner, with a long random password
   (keep it in the password manager, never in the repo):

   ```sql
   create role looker_reader login password '<long random password>' connection limit 5;
   alter role looker_reader set statement_timeout = '30s';
   grant usage on schema reporting to looker_reader;
   grant select on all tables in schema reporting to looker_reader;
   alter default privileges in schema reporting grant select on tables to looker_reader;
   ```

   This was tried on a scratch database: the role can read every view in
   `reporting`, gets *permission denied* on `applicants`, `myinfo_retrievals`,
   `api_logs` and the rest, and cannot write.

3. **Connect Looker Studio, one data source.** Add data source, **PostgreSQL**:
   - Host: the Neon **direct** (not `-pooler`) host from the connection string
   - Port `5432`, database `neondb`
   - Username `looker_reader`, the password from step 2
   - Tick **Enable SSL** (Neon requires it)

   The connector lists only tables in the `public` schema, which this login cannot
   read, so it says "There are no tables available in this database". That is
   expected. Choose **CUSTOM QUERY** and enter:

   ```sql
   select * from reporting.applicant_journey
   ```

   The connector makes one data source per table or query, so use this one and
   build all three report tables from it with filters (below), not four separate
   connections. `booked`, `customer_declined`, `stuck` and `stage_summary` exist for
   anyone who prefers a data source per table.

4. **Build the page** from that one data source:
   - **Booked**: Table with ref, created_at, mobile, booking_date, booking_time,
     apply, source, income, requested, os, max_eligible, approved; filter *Include*
     `stage` = `booked`.
   - **Customer rejected**: Table with ref, created_at, mobile, apply, source,
     decline_reason, income, requested, os, max_eligible, approved; filter *Include*
     `stage` = `declined_offer`.
   - **Never completed**: Table with ref, created_at, last_activity_at,
     hours_since_last_activity, mobile, stage, apply, source, requested, income,
     approved, documents, last_income_issue; filter *Exclude* `stage` is `booked`
     or `declined_offer`. Add a control on `stage` so staff can pull up one stage
     and call them.
   - **Funnel**: Bar chart, dimension `stage`, metric Record Count, sorted by
     `stage_order` ascending.
   - Sort the tables by created_at, newest first; add a date range control on
     created_at; green fill on *approved*; yellow rows where booking_date is empty.

5. **Refresh.** Looker Studio caches. Set the data source freshness to 15 minutes
   (Data source settings, Data freshness), or refresh by hand during the day.

## Who should see it

The tables include full mobile numbers, because following someone up is the point.
Share the report with named staff only (not "anyone with the link"), and keep the
database password out of Looker Studio's shared settings. To hide the numbers,
give a second data source a view that shows `right(mobile, 4)`.

## What this cannot show

- **People who left before Singpass.** An applicant row only exists once someone
  logs in (or reaches the review page), so anyone who opened the page and left is
  not in the database. Page analytics (Google Analytics or similar) is the tool for
  that step, and it is the biggest drop in most funnels.
- **People who clicked Singpass and never came back.** `apply_flow_events` has a
  `singpass_redirected` and an `auth_callback_received` event; their ratio per day
  would show it. Not in the views yet.
- **Which of Ascend's reasons rejected someone.** Ascend does not tell us in a form
  we store.
