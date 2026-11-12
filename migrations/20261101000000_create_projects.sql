create type public.project_visibility as enum ('public', 'private');

create table public.projects (
    id          uuid primary key default gen_random_uuid(),
    -- Auth user ids are text, matching auth.uid().
    owner_id    text not null default auth.uid(),
    name        text not null check (char_length(name) between 1 and 100),
    description text check (description is null or char_length(description) <= 1000),
    visibility  public.project_visibility not null default 'private',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);
create index projects_visibility_idx on public.projects (visibility);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger projects_set_updated_at
    before update on public.projects
    for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

-- Public projects are readable by anyone, private ones only by their owner.
create policy projects_select on public.projects for select
    using (visibility = 'public' or owner_id = auth.uid());
create policy projects_insert_own on public.projects for insert
    with check (owner_id = auth.uid());
create policy projects_update_own on public.projects for update
    using (owner_id = auth.uid());
create policy projects_delete_own on public.projects for delete
    using (owner_id = auth.uid());
