-- Projects can now be crosswords or a combination of two puzzle kinds.
alter table public.projects drop constraint if exists projects_puzzle_type_check;
alter table public.projects
  add constraint projects_puzzle_type_check
  check (puzzle_type in ('ws', 'scramble', 'crossword', 'combo'));
