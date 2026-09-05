-- Shared, unowned dashboard state for the branch team.
create table if not exists dashboard_state (
  state_key text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
