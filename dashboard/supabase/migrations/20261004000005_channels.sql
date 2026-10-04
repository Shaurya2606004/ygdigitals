-- The two studio-wide channels every install starts with. Project channels and DMs are created by the app.
insert into public.channels (id, type, name, read_only) values
  ('ch-general', 'public', 'general', false),
  ('ch-announce', 'public', 'announcements', true)
on conflict (id) do nothing;
