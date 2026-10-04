-- Live updates: every change to these tables is pushed to the browsers allowed to see the row (realtime
-- checks the same policies from 002 per person).
alter publication supabase_realtime add table
  public.people, public.clients, public.client_private, public.projects, public.tasks, public.task_private,
  public.deliverables, public.events, public.channels, public.messages, public.reads, public.posts,
  public.activity, public.notifications;
