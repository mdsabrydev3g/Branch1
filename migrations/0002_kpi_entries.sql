create table if not exists kpi_entries (
  period_id  text not null,
  dept       text not null,
  kpi        text not null,
  plan       bigint not null default 0,
  result     bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (period_id, dept, kpi)
);
