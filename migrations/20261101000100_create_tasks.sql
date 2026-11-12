create type public.task_status as enum ('todo', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');

create table public.tasks (
    id          uuid primary key default gen_random_uuid(),
    project_id  uuid not null references public.projects (id) on delete cascade,
    owner_id    text not null default auth.uid(),
    title       text not null check (char_length(title) between 1 and 200),
    status      public.task_status not null default 'todo',
    priority    public.task_priority not null default 'medium',
    due_date    date,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_owner_id_idx on public.tasks (owner_id);

create trigger tasks_set_updated_at
    before update on public.tasks
    for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- A task is visible when its project is (the subquery is itself filtered by projects RLS).
create policy tasks_select on public.tasks for select
    using (exists (select 1 from public.projects p where p.id = tasks.project_id));
-- Only the project owner can add tasks.
create policy tasks_insert_project_owner on public.tasks for insert
    with check (
        owner_id = auth.uid()
        and exists (
            select 1 from public.projects p
            where p.id = tasks.project_id and p.owner_id = auth.uid()
        )
    );
create policy tasks_update_own on public.tasks for update
    using (owner_id = auth.uid());
create policy tasks_delete_own on public.tasks for delete
    using (owner_id = auth.uid());
