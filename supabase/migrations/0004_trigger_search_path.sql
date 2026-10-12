-- Pin the search path of the trigger function flagged by the Supabase security advisor.
alter function public.projects_touch() set search_path = public;
