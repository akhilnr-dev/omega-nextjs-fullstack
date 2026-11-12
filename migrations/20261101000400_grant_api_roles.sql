-- New public tables get no privileges by default, so the data API returns 42501 until
-- they are granted. Grants decide which role may use a table; RLS still filters rows.
--   anon          = publishable key only (signed-out visitors)
--   authenticated = publishable key plus a signed-in user's JWT

grant usage on schema public to anon, authenticated;

grant select on public.projects, public.tasks, public.comments, public.project_task_counts
    to anon, authenticated;

grant insert, update, delete on public.projects, public.tasks to authenticated;
grant insert, delete on public.comments to authenticated;
