alter table public.evaluations
add column if not exists diagnostics_applicable boolean;

comment on column public.evaluations.diagnostics_applicable is
  'Operator-declared coaching-call context. True when a milestone or submitted diagnostic review is applicable; false otherwise; null only for legacy rows and kickoff calls.';

alter table public.evaluations
drop constraint if exists evaluations_diagnostics_context_check;

alter table public.evaluations
add constraint evaluations_diagnostics_context_check check (
  (call_type = 'kickoff' and diagnostics_applicable is null)
  or call_type = 'coaching'
);
