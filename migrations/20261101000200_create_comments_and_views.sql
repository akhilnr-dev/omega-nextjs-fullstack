create table public.comments (
    id          uuid primary key default gen_random_uuid(),
    task_id     uuid not null references public.tasks (id) on delete cascade,
    author_id   text not null default auth.uid(),
    body        text not null check (char_length(body) between 1 and 2000),
    created_at  timestamptz not null default now()
);

create index comments_task_id_idx on public.comments (task_id, created_at);

alter table public.comments enable row level security;

-- Any signed-in user can comment on a task they can see.
create policy comments_select on public.comments for select
    using (exists (select 1 from public.tasks t where t.id = comments.task_id));
create policy comments_insert_own on public.comments for insert
    with check (
        author_id = auth.uid()
        and exists (select 1 from public.tasks t where t.id = comments.task_id)
    );
create policy comments_delete_own on public.comments for delete
    using (author_id = auth.uid());

-- security_invoker applies the caller's RLS to the underlying tables.
create view public.project_task_counts
with (security_invoker = true) as
select
    p.id                                                as project_id,
    p.name                                              as project_name,
    count(t.id)                                         as total,
    count(t.id) filter (where t.status = 'todo')        as todo,
    count(t.id) filter (where t.status = 'in_progress') as in_progress,
    count(t.id) filter (where t.status = 'done')        as done
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id, p.name;
