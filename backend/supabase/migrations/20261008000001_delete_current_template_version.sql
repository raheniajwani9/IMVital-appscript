create or replace function public.delete_current_template_version(p_template_id text)
returns text
language plpgsql
as $$
declare
  v_template public.templates%rowtype;
  v_current public.template_versions%rowtype;
  v_previous public.template_versions%rowtype;
begin
  select * into v_template
  from public.templates
  where template_id = p_template_id
  for update;

  if not found then
    raise exception 'Form not found.';
  end if;

  select * into v_current
  from public.template_versions
  where id = v_template.current_version_id
    and template_id = p_template_id;

  if not found then
    raise exception 'The current form version could not be found.';
  end if;

  if v_current.version_number <= 1 or v_current.version_label = 'v1.0' then
    raise exception 'v1.0 cannot be deleted. It is the original version of this form.';
  end if;

  if exists (
    select 1 from public.audits
    where template_version_id = v_current.id
       or (template_version_id is null
           and template_id = p_template_id
           and template_version = v_current.version_label)
  ) then
    raise exception 'This version cannot be deleted because an audit has used it.';
  end if;

  select * into v_previous
  from public.template_versions
  where template_id = p_template_id
    and version_number < v_current.version_number
  order by version_number desc
  limit 1;

  if not found then
    raise exception 'No previous version is available to restore.';
  end if;

  update public.templates
  set current_version_id = v_previous.id,
      template_version = v_previous.version_label,
      template_name = v_previous.template_name,
      template_category = v_previous.template_category,
      template_description = v_previous.template_description,
      estimated_minutes = v_previous.estimated_minutes
  where template_id = p_template_id;

  delete from public.question_bank
  where template_id = p_template_id
    and template_version_id = v_current.id;

  delete from public.sections
  where template_id = p_template_id
    and template_version_id = v_current.id;

  delete from public.template_versions
  where id = v_current.id;

  return v_previous.version_label;
exception
  when foreign_key_violation then
    raise exception 'This version cannot be deleted because existing records reference it.';
end;
$$;
