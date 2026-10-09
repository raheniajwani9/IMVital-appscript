create table if not exists public.form_visibility (
  template_id text primary key references public.templates(template_id) on delete cascade,
  mode text not null default 'VISIBLE_ALL'
    check (mode in ('VISIBLE_ALL', 'HIDDEN_ALL', 'HIDDEN_SELECTED')),
  hidden_pod_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function public.is_active_form_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.auth_user_id = auth.uid()
      and upper(btrim(u.role)) = 'ADMIN'
      and u.active = true
  );
$$;

revoke all on function public.is_active_form_admin() from public;
grant execute on function public.is_active_form_admin() to authenticated;

alter table public.form_visibility enable row level security;
grant select, insert, update on public.form_visibility to authenticated;
drop policy if exists form_visibility_read on public.form_visibility;
create policy form_visibility_read on public.form_visibility
  for select to authenticated using (true);
drop policy if exists form_visibility_admin_insert on public.form_visibility;
create policy form_visibility_admin_insert on public.form_visibility
  for insert to authenticated with check (public.is_active_form_admin());
drop policy if exists form_visibility_admin_update on public.form_visibility;
create policy form_visibility_admin_update on public.form_visibility
  for update to authenticated
  using (public.is_active_form_admin())
  with check (public.is_active_form_admin());

create or replace function public.form_is_visible(p_template_id text, p_location_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case v.mode
      when 'HIDDEN_ALL' then false
      when 'HIDDEN_SELECTED' then not exists (
        select 1 from unnest(v.hidden_pod_ids) as pod(id)
        where lower(btrim(pod.id)) = lower(btrim(coalesce(p_location_id, '')))
      )
      else true
    end
    from public.form_visibility v
    where v.template_id = p_template_id
  ), true);
$$;

create or replace function public.enforce_audit_form_visibility()
returns trigger
language plpgsql
as $$
begin
  -- Manager changes to an already submitted audit remain available.
  if tg_op = 'UPDATE' then
    if old.status <> 'IN_PROGRESS' then
      return new;
    end if;
  end if;
  if not public.form_is_visible(new.template_id, new.location_id) then
    raise exception 'This form is hidden for this POD. The audit cannot be started, saved, or submitted.';
  end if;
  return new;
end;
$$;

drop trigger if exists audits_form_visibility_guard on public.audits;
create trigger audits_form_visibility_guard
before insert or update on public.audits
for each row execute function public.enforce_audit_form_visibility();

-- Clean up the function if an earlier run stopped while trying to add a
-- trigger to the audit_drafts table, which is not part of this database.
drop function if exists public.enforce_draft_form_visibility();

create or replace function public.enforce_response_form_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_id text;
  v_status text;
begin
  select a.location_id, a.status into v_location_id, v_status
  from public.audits a where a.audit_id = new.audit_id;

  -- A submission that already passed the audits guard may finish writing its
  -- responses even if visibility changes in the middle of that submission.
  if v_status <> 'SUBMITTED' and not public.form_is_visible(new.template_id, v_location_id) then
    raise exception 'This form is hidden for this POD. Responses cannot be submitted.';
  end if;
  return new;
end;
$$;

drop trigger if exists responses_form_visibility_guard on public.responses;
create trigger responses_form_visibility_guard
before insert or update on public.responses
for each row execute function public.enforce_response_form_visibility();
