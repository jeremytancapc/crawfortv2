-- Income documents accepted although they show no name - gig-app earnings
-- screenshots, which often print none. Recorded on the reading so anyone
-- reviewing the decision later can see which evidence was never tied to the
-- applicant by name. A name that is shown and does not match is refused, not
-- recorded here.

alter table income_readings
  add column name_not_shown_for text[] not null default '{}';

comment on column income_readings.name_not_shown_for is
  'File names of earnings statements accepted without a name on them.';
