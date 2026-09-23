-- Prevent stale dashboard clients from overwriting newer shared data.
alter table dashboard_state
  add column if not exists revision bigint not null default 1;
