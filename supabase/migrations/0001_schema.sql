-- Lehar HRMS schema. Single source of truth for tables; see ARCHITECTURE.md §3.
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- locations / departments
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null,
  state text not null,
  -- 0 = Sunday … 6 = Saturday
  weekly_off_days smallint[] not null default '{0}',
  constraint weekly_off_days_valid check (weekly_off_days <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ---------------------------------------------------------------- employees
create sequence employee_code_seq start 1;

create table employees (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  employee_code text not null unique
    default ('KCF' || lpad(nextval('employee_code_seq')::text, 4, '0')),
  full_name text not null check (length(trim(full_name)) >= 2),
  email text not null,
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  dob date not null,
  gender text not null check (gender in ('Female', 'Male', 'Other')),
  address_line text,
  city text,
  state text,
  pin_code text check (pin_code is null or pin_code ~ '^[0-9]{6}$'),
  date_of_joining date not null,
  last_working_day date,
  designation text not null,
  grade text,
  department_id uuid not null references departments(id),
  location_id uuid not null references locations(id),
  reporting_manager_id uuid references employees(id),
  is_hr_admin boolean not null default false,
  emergency_name text,
  emergency_relation text,
  emergency_mobile text check (emergency_mobile is null or emergency_mobile ~ '^[6-9][0-9]{9}$'),
  created_at timestamptz not null default now(),
  constraint employee_code_format check (employee_code ~ '^KCF[0-9]{4,}$'),
  constraint at_least_18_on_joining check (dob <= date_of_joining - interval '18 years'),
  constraint not_own_manager check (reporting_manager_id is null or reporting_manager_id <> id),
  constraint lwd_after_joining check (last_working_day is null or last_working_day >= date_of_joining)
);
create unique index employees_email_lower on employees (lower(email));
create index employees_manager on employees (reporting_manager_id);

-- The employee code never changes.
create function prevent_code_change() returns trigger language plpgsql as $$
begin
  if new.employee_code <> old.employee_code then
    raise exception 'employee_code cannot be changed';
  end if;
  return new;
end $$;
create trigger employees_code_immutable before update on employees
  for each row execute function prevent_code_change();

-- Reporting loops (A → B → A) are blocked in the database too.
create function prevent_reporting_loop() returns trigger language plpgsql as $$
declare
  cur uuid := new.reporting_manager_id;
  hops int := 0;
begin
  while cur is not null loop
    if cur = new.id then
      raise exception 'invalid reporting manager: this would create a reporting loop';
    end if;
    select reporting_manager_id into cur from employees where id = cur;
    hops := hops + 1;
    exit when hops > 1000;
  end loop;
  return new;
end $$;
create trigger employees_no_loop before insert or update of reporting_manager_id on employees
  for each row execute function prevent_reporting_loop();

create table employee_statutory (
  employee_id uuid primary key references employees(id) on delete restrict,
  pan text not null unique check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  aadhaar text not null unique check (aadhaar ~ '^[0-9]{12}$'),
  uan text check (uan is null or uan ~ '^[0-9]{12}$')
);

create table employee_bank (
  employee_id uuid primary key references employees(id) on delete restrict,
  account_number text not null check (account_number ~ '^[0-9]{9,18}$'),
  ifsc text not null check (ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name text not null
);

-- ---------------------------------------------------------------- holidays
create table holidays (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  date date not null,
  name text not null,
  type text not null check (type in ('National', 'State', 'Optional')),
  unique (location_id, date)
);

-- ---------------------------------------------------------------- attendance
create table attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  date date not null,
  check_in timestamptz,
  check_out timestamptz,
  is_wfh boolean not null default false,
  is_late boolean not null default false,
  regularised boolean not null default false,
  created_at timestamptz not null default now(),
  -- one record per employee per day
  constraint attendance_one_per_day unique (employee_id, date),
  constraint checkout_after_checkin check (check_out is null or (check_in is not null and check_out > check_in))
);

create table regularisation_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  date date not null,
  attendance_id uuid references attendance(id),
  requested_in timestamptz not null,
  requested_out timestamptz not null,
  reason text not null check (length(trim(reason)) >= 3),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_id uuid references employees(id),
  approver_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reg_out_after_in check (requested_out > requested_in)
);
create unique index reg_one_pending_per_day on regularisation_requests (employee_id, date) where status = 'pending';

-- ---------------------------------------------------------------- leave
create table leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,5}$'),
  name text not null,
  annual_quota numeric(6,2) check (annual_quota is null or annual_quota >= 0), -- null = unlimited
  accrual_method text not null check (accrual_method in ('annual_prorated', 'monthly', 'on_request', 'none')),
  carry_forward_max numeric(6,2) not null default 0 check (carry_forward_max >= 0),
  half_day_allowed boolean not null default false,
  requires_certificate_after_days numeric(6,2),
  count_calendar_days boolean not null default false,
  gender_restriction text check (gender_restriction is null or gender_restriction in ('Female', 'Male')),
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  leave_type_id uuid not null references leave_types(id),
  year int not null check (year between 2000 and 2100),
  opening numeric(6,2) not null default 0 check (opening >= 0),
  used numeric(6,2) not null default 0 check (used >= 0),
  unique (employee_id, leave_type_id, year)
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  leave_type_id uuid not null references leave_types(id),
  from_date date not null,
  to_date date not null,
  is_half_day boolean not null default false,
  days numeric(6,2) not null check (days > 0),
  reason text not null check (length(trim(reason)) >= 3),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references employees(id),
  approver_comment text,
  attachment_url text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint leave_dates_order check (to_date >= from_date),
  constraint leave_same_year check (extract(year from from_date) = extract(year from to_date)),
  constraint leave_half_day_shape check (not is_half_day or (from_date = to_date and days = 0.5))
);
create index leave_requests_emp on leave_requests (employee_id, status);
create index leave_requests_dates on leave_requests (from_date, to_date);

-- ---------------------------------------------------------------- audit / policy / agent
create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  field text not null,
  old_value text,
  new_value text,
  action text not null default 'update' check (action in ('create', 'update', 'reveal', 'deactivate', 'correct')),
  reason text,
  changed_by uuid references employees(id),
  changed_at timestamptz not null default now()
);
create index audit_record on audit_log (record_id, changed_at desc);

create table policy_documents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

create table agent_log (
  id bigint generated always as identity primary key,
  employee_id uuid not null references employees(id),
  tool text not null,
  inputs jsonb,
  result jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- atomic functions

-- Create an employee with statutory, bank, leave balances and audit entry in one transaction.
create function create_employee(p jsonb, p_actor uuid) returns employees
language plpgsql as $$
declare
  e employees;
  lt record;
begin
  insert into employees (
    full_name, email, mobile, dob, gender, address_line, city, state, pin_code,
    date_of_joining, designation, grade, department_id, location_id, reporting_manager_id,
    is_hr_admin, emergency_name, emergency_relation, emergency_mobile
  ) values (
    p->>'full_name', lower(p->>'email'), p->>'mobile', (p->>'dob')::date, p->>'gender',
    p->>'address_line', p->>'city', p->>'state', p->>'pin_code',
    (p->>'date_of_joining')::date, p->>'designation', nullif(p->>'grade', ''),
    (p->>'department_id')::uuid, (p->>'location_id')::uuid, nullif(p->>'reporting_manager_id', '')::uuid,
    coalesce((p->>'is_hr_admin')::boolean, false),
    p->>'emergency_name', p->>'emergency_relation', nullif(p->>'emergency_mobile', '')
  ) returning * into e;

  insert into employee_statutory (employee_id, pan, aadhaar, uan)
  values (e.id, p->>'pan', p->>'aadhaar', nullif(p->>'uan', ''));

  insert into employee_bank (employee_id, account_number, ifsc, bank_name)
  values (e.id, p->>'account_number', p->>'ifsc', p->>'bank_name');

  -- Balance rows for the joining year. Accrued (incl. CL/SL pro-rating) is calculated in code.
  for lt in select id from leave_types where is_active loop
    insert into leave_balances (employee_id, leave_type_id, year, opening, used)
    values (e.id, lt.id, extract(year from e.date_of_joining)::int, 0, 0)
    on conflict do nothing;
  end loop;

  insert into audit_log (table_name, record_id, field, new_value, action, changed_by)
  values ('employees', e.id, 'employee', e.employee_code, 'create', p_actor);

  return e;
end $$;

-- Approve or reject a pending leave request. Balance changes only on approval,
-- and only if the request is still pending (so a double click cannot count twice).
create function decide_leave_request(p_request uuid, p_approver uuid, p_approve boolean, p_comment text)
returns leave_requests language plpgsql as $$
declare
  r leave_requests;
begin
  update leave_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         approver_id = p_approver,
         approver_comment = p_comment,
         decided_at = now()
   where id = p_request and status = 'pending' and employee_id <> p_approver
  returning * into r;

  if r.id is null then
    raise exception 'request is no longer pending';
  end if;

  if p_approve then
    insert into leave_balances (employee_id, leave_type_id, year, opening, used)
    values (r.employee_id, r.leave_type_id, extract(year from r.from_date)::int, 0, r.days)
    on conflict (employee_id, leave_type_id, year)
    do update set used = leave_balances.used + excluded.used;
  end if;
  return r;
end $$;

-- Cancel own leave: pending (nothing to restore) or approved and not yet started (restore used).
create function cancel_leave_request(p_request uuid, p_employee uuid, p_today date)
returns leave_requests language plpgsql as $$
declare
  r leave_requests;
  was text;
begin
  select status into was from leave_requests
   where id = p_request and employee_id = p_employee for update;

  update leave_requests
     set status = 'cancelled', decided_at = now()
   where id = p_request and employee_id = p_employee
     and (status = 'pending' or (status = 'approved' and from_date > p_today))
  returning * into r;

  if r.id is null then
    raise exception 'this leave can no longer be cancelled';
  end if;

  if was = 'approved' then
    update leave_balances set used = greatest(used - r.days, 0)
     where employee_id = r.employee_id and leave_type_id = r.leave_type_id
       and year = extract(year from r.from_date)::int;
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------- row-level security
-- RLS on every table with no policies: the public anon key can read nothing.
-- Only the server (service role, which bypasses RLS) reads data, after lib/auth checks.
alter table locations enable row level security;
alter table departments enable row level security;
alter table employees enable row level security;
alter table employee_statutory enable row level security;
alter table employee_bank enable row level security;
alter table holidays enable row level security;
alter table attendance enable row level security;
alter table regularisation_requests enable row level security;
alter table leave_types enable row level security;
alter table leave_balances enable row level security;
alter table leave_requests enable row level security;
alter table audit_log enable row level security;
alter table policy_documents enable row level security;
alter table agent_log enable row level security;

-- Sensitive tables: also remove every privilege from the client roles.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on employee_statutory, employee_bank from anon';
    execute 'revoke execute on function create_employee(jsonb, uuid), decide_leave_request(uuid, uuid, boolean, text), cancel_leave_request(uuid, uuid, date) from anon, public';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on employee_statutory, employee_bank from authenticated';
    execute 'revoke execute on function create_employee(jsonb, uuid), decide_leave_request(uuid, uuid, boolean, text), cancel_leave_request(uuid, uuid, date) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function create_employee(jsonb, uuid), decide_leave_request(uuid, uuid, boolean, text), cancel_leave_request(uuid, uuid, date) to service_role';
  end if;
end $$;

-- Medical certificates bucket (private). Requires Supabase storage.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('certificates', 'certificates', false)
    on conflict (id) do nothing;
  end if;
end $$;
