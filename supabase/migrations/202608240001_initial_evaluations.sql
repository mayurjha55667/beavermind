create extension if not exists pgcrypto;

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  call_type text not null check (call_type in ('kickoff', 'coaching')),
  original_transcript text not null,
  numbered_transcript text not null,
  status text not null default 'queued' check (
    status in (
      'queued', 'extracting_evidence', 'scoring', 'validating',
      'synthesizing', 'completed', 'failed'
    )
  ),
  current_stage text not null default 'queued' check (
    current_stage in (
      'queued', 'extracting_evidence', 'scoring', 'validating',
      'synthesizing', 'completed', 'failed'
    )
  ),
  rubric_version text not null,
  prompt_version text not null,
  model_provider text not null,
  model_name text not null,
  workflow_run_id text,
  raw_score numeric(6, 1),
  max_possible_score numeric(6, 1),
  normalized_score numeric(6, 1),
  final_score numeric(6, 1),
  grade text check (grade in ('ELITE', 'STRONG', 'INCONSISTENT', 'AT RISK', 'FAIL')),
  applied_caps jsonb not null default '[]'::jsonb,
  one_thing jsonb,
  brief text,
  red_flags jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  internal_error jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dimension_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  dimension_id integer not null check (dimension_id between 1 and 12),
  name text not null,
  score numeric(6, 1),
  rubric_max_score numeric(6, 1) not null,
  effective_max_score numeric(6, 1) not null,
  weighted_score numeric(6, 1) not null,
  band text not null check (band in ('ELITE', 'STRONG', 'MID', 'SURFACE', 'WEAK', 'FAIL', 'N/A')),
  disabled boolean not null default false,
  disabled_reason text,
  reasoning text not null,
  quick_fix text not null,
  missing_behaviours jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  improvement_potential numeric(6, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, dimension_id),
  check ((disabled and score is null and band = 'N/A') or (not disabled and score is not null and band <> 'N/A'))
);

create table public.evaluation_stage_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  stage text not null check (stage in ('evidence', 'scoring', 'validation', 'synthesis')),
  schema_version text not null,
  result jsonb not null,
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evaluation_id, stage, schema_version)
);

create index evaluations_status_created_at_idx on public.evaluations (status, created_at desc);
create index evaluations_created_at_idx on public.evaluations (created_at desc);
create index dimension_results_evaluation_id_idx on public.dimension_results (evaluation_id);
create index evaluation_stage_results_evaluation_id_idx on public.evaluation_stage_results (evaluation_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger evaluations_set_updated_at
before update on public.evaluations
for each row execute function public.set_updated_at();

create trigger dimension_results_set_updated_at
before update on public.dimension_results
for each row execute function public.set_updated_at();

create trigger evaluation_stage_results_set_updated_at
before update on public.evaluation_stage_results
for each row execute function public.set_updated_at();

create or replace function public.increment_evaluation_attempt(evaluation_uuid uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.evaluations
  set attempt_count = attempt_count + 1
  where id = evaluation_uuid;
$$;

alter table public.evaluations enable row level security;
alter table public.dimension_results enable row level security;
alter table public.evaluation_stage_results enable row level security;

-- No anon/authenticated policies are intentional. Public report reads and every write
-- pass through server-only route handlers using a dedicated service-role client.
revoke all on public.evaluations from anon, authenticated;
revoke all on public.dimension_results from anon, authenticated;
revoke all on public.evaluation_stage_results from anon, authenticated;
revoke execute on function public.increment_evaluation_attempt(uuid) from public, anon, authenticated;
grant execute on function public.increment_evaluation_attempt(uuid) to service_role;
