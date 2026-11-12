alter table public.tasks
    add column labels text[] not null default '{}';

create index tasks_labels_idx on public.tasks using gin (labels);

-- Migrations run without a user session, so seed rows use a fixed owner id.
-- The demo project is public, so anyone can read it.
insert into public.projects (id, owner_id, name, description, visibility)
values (
    '00000000-0000-4000-8000-000000000001',
    'seed',
    'Demo project',
    'Seeded by a migration. Readable by everyone.',
    'public'
);

insert into public.tasks (project_id, owner_id, title, status, priority, labels)
values
    ('00000000-0000-4000-8000-000000000001', 'seed', 'Provision the database',  'done',        'high',   '{infra}'),
    ('00000000-0000-4000-8000-000000000001', 'seed', 'Apply schema migrations', 'in_progress', 'high',   '{infra,db}'),
    ('00000000-0000-4000-8000-000000000001', 'seed', 'Invite the team',         'todo',        'medium', '{}');
