-- PostgreSQL schema for CloudSync Reader MVP

create extension if not exists "pgcrypto";

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  provider text not null check (provider in ('mega', 'local')),
  provider_user_id text not null,
  access_token_encrypted text,
  refresh_token_encrypted text,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);

create table if not exists library (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references app_user(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists library_member (
  library_id uuid not null references library(id) on delete cascade,
  user_id uuid not null references app_user(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (library_id, user_id)
);

create table if not exists invite_code (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references library(id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('editor', 'viewer')),
  expires_at timestamptz,
  max_redemptions int not null default 1,
  redeemed_count int not null default 0,
  created_by_user_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists book (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references library(id) on delete cascade,
  title text,
  author text,
  format text not null check (format in ('pdf', 'epub')),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists book_source (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null unique references book(id) on delete cascade,
  provider text not null check (provider in ('mega')),
  remote_path text not null,
  remote_node_id text,
  checksum text,
  last_seen_at timestamptz not null default now()
);

create table if not exists reading_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  book_id uuid not null references book(id) on delete cascade,
  device_id text not null,
  position_type text not null check (position_type in ('epub-cfi', 'pdf-page')),
  position_value text not null,
  percent numeric(5,2) not null default 0,
  updated_at timestamptz not null,
  client_seq bigint not null,
  unique (user_id, book_id)
);

create table if not exists sync_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  book_id uuid not null references book(id) on delete cascade,
  device_id text not null,
  event_type text not null check (event_type in ('progress_updated', 'annotation_created', 'annotation_deleted')),
  payload jsonb not null,
  client_seq bigint,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create table if not exists annotation (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_user(id) on delete cascade,
  book_id uuid not null references book(id) on delete cascade,
  annotation_type text not null check (annotation_type in ('highlight', 'note', 'bookmark')),
  locator text not null,
  color text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_book_library on book(library_id);
create index if not exists idx_sync_event_book_user_received on sync_event(book_id, user_id, received_at desc);
create index if not exists idx_reading_state_user_book on reading_state(user_id, book_id);
