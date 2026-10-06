-- Income documents are stored when the applicant adds them, read from that
-- stored copy, and submitted from it. Until now a file lived only in the
-- browser until Submit, so the reading and the document could drift apart and
-- the figures sent to Ascend were whatever the browser said they were.
--
-- Three tables: the documents, each reading taken from a set of them, and an
-- append-only log of everything that happened to either.

create table income_documents (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  applicant_id   uuid not null references applicants (id) on delete cascade,

  -- Where the bytes are. Random, never derived from the applicant's own
  -- filename (see lib/documents/links.ts).
  object_key     text not null,
  -- As the applicant named it; shown back to them and sent to Ascend.
  file_name      text not null,
  content_type   text not null,
  bytes          integer not null,
  -- Proves later that what was read is what was stored.
  sha256         text not null,

  -- uploaded  stored, not yet read
  -- read      read as part of a reading (kind and file_type are set)
  -- submitted sent to Ascend; kept as the record behind a credit decision
  -- removed   the applicant took it off; the bytes are deleted
  -- expired   never submitted, and deleted after the retention window
  status         text not null default 'uploaded'
                   check (status in ('uploaded', 'read', 'submitted', 'removed', 'expired')),

  -- What the reader decided it is: payslip, bank_statement, earnings_statement.
  kind           text,
  -- What Ascend is told this file is. Belongs to the file by id, not by its
  -- position in a list.
  file_type      text,
  reading_id     uuid,

  read_at        timestamptz,
  submitted_at   timestamptz,
  removed_at     timestamptz,
  -- Set only once the object is actually gone from the bucket.
  deleted_from_storage_at timestamptz
);

create trigger income_documents_updated_at
  before update on income_documents
  for each row execute function set_updated_at();

create index income_documents_applicant_idx on income_documents (applicant_id);
create index income_documents_stale_idx
  on income_documents (created_at) where status in ('uploaded', 'read');

-- One reading: what was taken off one exact set of documents.
create table income_readings (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  applicant_id   uuid not null references applicants (id) on delete cascade,
  -- Ascend's incomeType for the set, e.g. PANEL_PAYSLIP.
  income_type    text not null,
  -- [{ month: "2026-08", amount: 4200, employer: "..." }], most recent first.
  months         jsonb not null,
  average        numeric(10,2) not null,
  -- What Ascend is sent, most recent first. Months not read are the average
  -- of those that were, so these are always three figures.
  m1             numeric(12,2) not null,
  m2             numeric(12,2) not null,
  m3             numeric(12,2) not null,
  advice         text,
  -- The documents this was read from. Submit refuses if the applicant's
  -- documents are no longer exactly these.
  document_ids   uuid[] not null
);

create index income_readings_applicant_idx on income_readings (applicant_id);

alter table income_documents
  add constraint income_documents_reading_fk
  foreign key (reading_id) references income_readings (id) on delete set null;

-- Append-only. Nothing here is updated or deleted by the application.
create table income_document_events (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),

  applicant_id   uuid not null references applicants (id) on delete cascade,
  document_id    uuid references income_documents (id) on delete set null,
  reading_id     uuid references income_readings (id) on delete set null,

  -- uploaded | upload_failed | removed | deleted_from_storage |
  -- delete_failed | read | read_not_usable | read_failed | submitted |
  -- submit_failed | expired
  event          text not null,
  detail         jsonb not null default '{}'
);

create index income_document_events_applicant_idx
  on income_document_events (applicant_id, created_at);

comment on table income_documents is
  'An applicant''s income document, stored on upload. Bytes are deleted on removal or expiry; the row stays as the record.';
comment on table income_readings is
  'What was read off one exact set of documents. Submitted to Ascend as stored, never as the browser sends it.';
comment on table income_document_events is
  'Append-only audit log of everything that happened to an applicant''s income documents.';
