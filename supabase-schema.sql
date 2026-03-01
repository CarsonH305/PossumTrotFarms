-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor) to create tables for Possum Trot Farms.

-- Bookings: who is at the farm and when
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  who text,
  is_yearly boolean default false,
  created_at timestamptz default now()
);

-- Vendors: service providers by category (category can be any text, e.g. plumbing, electrical, HVAC, Landscaping)
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

-- If you already created vendors with the old CHECK: allow custom categories by dropping it:
-- alter table public.vendors drop constraint if exists vendors_category_check;

-- If you already have vendors table, add new columns:
-- alter table public.vendors add column if not exists contact_name text;
-- alter table public.vendors add column if not exists notes text;

-- Allow anonymous read/write (site will be protected at the host; adjust in production if you add Supabase Auth)
alter table public.bookings enable row level security;
alter table public.vendors enable row level security;

-- Meetings: single-day events with notes and file attachments
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  title text,
  notes text,
  created_at timestamptz default now()
);

-- Meeting file attachments (storage path in Supabase Storage bucket "meeting-files")
create table if not exists public.meeting_files (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

alter table public.meetings enable row level security;
alter table public.meeting_files enable row level security;
create policy "Allow all for meetings" on public.meetings for all using (true) with check (true);
create policy "Allow all for meeting_files" on public.meeting_files for all using (true) with check (true);

-- Storage: In Supabase Dashboard → Storage, create a bucket named "meeting-files".
-- Set it to Public if you want direct download links, then add policy:
-- "Allow all" for SELECT, INSERT, UPDATE, DELETE so the app can upload and list files.

create policy "Allow all for bookings" on public.bookings for all using (true) with check (true);
create policy "Allow all for vendors" on public.vendors for all using (true) with check (true);
