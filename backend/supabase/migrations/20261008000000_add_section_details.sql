alter table public.sections
  add column if not exists section_category text,
  add column if not exists section_weight numeric(5,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sections_weight_range'
      and conrelid = 'public.sections'::regclass
  ) then
    alter table public.sections
      add constraint sections_weight_range
      check (section_weight is null or section_weight > 0 and section_weight <= 100);
  end if;
end $$;
