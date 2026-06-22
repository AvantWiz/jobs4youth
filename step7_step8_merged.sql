-- Step 7 + Step 8 merged backend updates for Jobs4Youth
-- Run this after your base schema/policies.

-- STEP 7: verification documents table
create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint,
  document_type text check (
    document_type in (
      'Business Registration Certificate',
      'Tax Compliance Certificate',
      'Accreditation or Licence',
      'Organisation Profile',
      'Authorisation Letter',
      'Other Supporting Document'
    )
  ) not null,
  review_status text check (review_status in ('Pending','Approved','Rejected')) default 'Pending',
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_verification_documents_profile on public.verification_documents(profile_id);
create index if not exists idx_verification_documents_status on public.verification_documents(review_status);
alter table public.verification_documents enable row level security;

do $$ begin
  drop policy if exists "Users can insert own verification documents" on public.verification_documents;
  drop policy if exists "Users can view own verification documents" on public.verification_documents;
  drop policy if exists "Admins can view all verification documents" on public.verification_documents;
  drop policy if exists "Admins can update verification documents" on public.verification_documents;
exception when undefined_object then null; end $$;

create policy "Users can insert own verification documents" on public.verification_documents
for insert with check (
  auth.uid() = profile_id
  and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('employer','institution','admin')
  )
);
create policy "Users can view own verification documents" on public.verification_documents
for select using (auth.uid() = profile_id);
create policy "Admins can view all verification documents" on public.verification_documents
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "Admins can update verification documents" on public.verification_documents
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

insert into storage.buckets (id, name, public)
select 'verification-documents', 'verification-documents', false
where not exists (select 1 from storage.buckets where id = 'verification-documents');

do $$ begin
  drop policy if exists "Users can upload own verification documents" on storage.objects;
  drop policy if exists "Users can view own verification documents in storage" on storage.objects;
  drop policy if exists "Admins can view verification documents in storage" on storage.objects;
exception when undefined_object then null; end $$;

create policy "Users can upload own verification documents" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'verification-documents' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can view own verification documents in storage" on storage.objects
for select to authenticated
using (
  bucket_id = 'verification-documents' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Admins can view verification documents in storage" on storage.objects
for select to authenticated
using (
  bucket_id = 'verification-documents'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- STEP 8: notifications + email queue
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  notification_type text not null,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);
create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  email_type text not null,
  related_entity_type text,
  related_entity_id uuid,
  queue_status text check (queue_status in ('Queued','Sent','Failed')) default 'Queued',
  error_message text,
  created_at timestamptz default now(),
  processed_at timestamptz
);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_email_queue_user_created on public.email_queue(user_id, created_at desc);
create index if not exists idx_email_queue_status on public.email_queue(queue_status);
alter table public.notifications enable row level security;
alter table public.email_queue enable row level security;

do $$ begin
  drop policy if exists "Users can view own notifications" on public.notifications;
  drop policy if exists "Users can update own notifications" on public.notifications;
  drop policy if exists "Admins can insert notifications" on public.notifications;
  drop policy if exists "Users can view own queued emails" on public.email_queue;
  drop policy if exists "Authenticated users can insert email queue rows" on public.email_queue;
  drop policy if exists "Admins can update email queue rows" on public.email_queue;
exception when undefined_object then null; end $$;

create policy "Users can view own notifications" on public.notifications
for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "Admins can insert notifications" on public.notifications
for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  and actor_id = auth.uid()
);
create policy "Users can view own queued emails" on public.email_queue
for select using (auth.uid() = user_id);
create policy "Authenticated users can insert email queue rows" on public.email_queue
for insert with check (actor_id = auth.uid());
create policy "Admins can update email queue rows" on public.email_queue
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
