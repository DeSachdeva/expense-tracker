-- ============================================================
-- TRIP / GROUP EXPENSE TRACKER — DATABASE SCHEMA
-- Run this whole file once in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- ── PROJECTS ──
-- A "project" is any shared expense group: a trip, a flatshare, an event, etc.
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  currency text not null default 'INR',
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now(),
  deleted_at timestamptz  -- soft delete: null = active, set = in trash
);

-- ── PROJECT MEMBERS ──
-- A member can be a real registered user (user_id set) or a placeholder person
-- added by the owner (user_id null, just a display_name) for people who don't want to sign up.
create table project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role text not null default 'member' check (role in ('owner','member')),
  invited_email text,
  joined_at timestamptz not null default now()
);

-- ── PAYMENT MODES ──
-- Default modes are seeded per project; users can add custom ones.
create table payment_modes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

-- ── CATEGORIES ──
create table categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

-- ── EXPENSES ──
create table expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  day_label text,           -- e.g. "Day 3" — optional
  expense_date date,        -- optional calendar date
  category_id uuid references categories(id) on delete set null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  paid_by uuid not null references project_members(id) on delete cascade,
  split_among uuid[] not null,  -- array of project_members.id
  notes text,
  receipt_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint day_or_date_required check (day_label is not null or expense_date is not null)
);

-- ── SETTLEMENT PAYMENTS ──
-- Payments already made directly between members (outside of shared expenses).
create table settlement_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  from_member uuid not null references project_members(id) on delete cascade,
  to_member uuid not null references project_members(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (from_member <> to_member)
);

-- ── RECURRING EXPENSE TEMPLATES ──
create table expense_templates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,                 -- e.g. "Daily breakfast"
  description text not null,
  amount numeric(12,2),
  category_id uuid references categories(id) on delete set null,
  payment_mode_id uuid references payment_modes(id) on delete set null,
  default_paid_by uuid references project_members(id) on delete set null,
  default_split_among uuid[],
  created_at timestamptz not null default now()
);

-- ── ACTIVITY LOG ──
-- Tracks every meaningful change for audit/trust/recovery purposes.
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_id uuid references auth.users(id),
  actor_name text not null,
  action text not null,        -- 'created','updated','deleted','restored'
  entity_type text not null,   -- 'expense','settlement','member','project','template'
  entity_id uuid,
  summary text not null,       -- human-readable: "Added expense 'Taxi to airport' (₹450)"
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ── PROJECT INVITES (email invites, separate from invite_code link) ──
create table project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_members_project on project_members(project_id);
create index idx_members_user on project_members(user_id);
create index idx_expenses_project on expenses(project_id) where deleted_at is null;
create index idx_settlements_project on settlement_payments(project_id) where deleted_at is null;
create index idx_activity_project on activity_log(project_id, created_at desc);
create index idx_projects_owner on projects(owner_id) where deleted_at is null;

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table is locked down so users only see data for projects they belong to.
-- ============================================================
alter table projects enable row level security;
alter table project_members enable row level security;
alter table payment_modes enable row level security;
alter table categories enable row level security;
alter table expenses enable row level security;
alter table settlement_payments enable row level security;
alter table expense_templates enable row level security;
alter table activity_log enable row level security;
alter table project_invites enable row level security;

-- Helper: is the current user a member of this project?
create or replace function is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id and user_id = auth.uid()
  ) or exists (
    select 1 from projects where id = p_project_id and owner_id = auth.uid()
  );
$$ language sql security definer stable;

-- PROJECTS: owner can do everything; members can view
create policy "members can view their projects" on projects
  for select using (is_project_member(id) and deleted_at is null);
create policy "owner can update their projects" on projects
  for update using (owner_id = auth.uid());
create policy "anyone authenticated can create a project" on projects
  for insert with check (owner_id = auth.uid());
create policy "owner can delete their projects" on projects
  for delete using (owner_id = auth.uid());

-- MEMBERS
create policy "project members can view member list" on project_members
  for select using (is_project_member(project_id));
create policy "project members can add members" on project_members
  for insert with check (is_project_member(project_id));
create policy "owner can remove members" on project_members
  for delete using (exists (select 1 from projects where id = project_id and owner_id = auth.uid()));

-- PAYMENT MODES / CATEGORIES
create policy "members can view payment modes" on payment_modes for select using (is_project_member(project_id));
create policy "members can add payment modes" on payment_modes for insert with check (is_project_member(project_id));
create policy "members can delete custom payment modes" on payment_modes for delete using (is_project_member(project_id) and not is_default);

create policy "members can view categories" on categories for select using (is_project_member(project_id));
create policy "members can add categories" on categories for insert with check (is_project_member(project_id));

-- EXPENSES
create policy "members can view expenses" on expenses for select using (is_project_member(project_id));
create policy "members can add expenses" on expenses for insert with check (is_project_member(project_id));
create policy "members can update expenses" on expenses for update using (is_project_member(project_id));
create policy "members can soft-delete expenses" on expenses for delete using (is_project_member(project_id));

-- SETTLEMENTS
create policy "members can view settlements" on settlement_payments for select using (is_project_member(project_id));
create policy "members can add settlements" on settlement_payments for insert with check (is_project_member(project_id));
create policy "members can update settlements" on settlement_payments for update using (is_project_member(project_id));

-- TEMPLATES
create policy "members can view templates" on expense_templates for select using (is_project_member(project_id));
create policy "members can manage templates" on expense_templates for all using (is_project_member(project_id));

-- ACTIVITY LOG (read-only from client; inserts happen via triggers/app logic)
create policy "members can view activity log" on activity_log for select using (is_project_member(project_id));
create policy "members can write activity log" on activity_log for insert with check (is_project_member(project_id));

-- INVITES
create policy "members can view invites for their project" on project_invites for select using (is_project_member(project_id));
create policy "members can create invites" on project_invites for insert with check (is_project_member(project_id));

-- ============================================================
-- TRIGGER: auto-add owner as first project member when a project is created
-- ============================================================
create or replace function handle_new_project()
returns trigger as $$
begin
  insert into project_members (project_id, user_id, display_name, role)
  values (
    new.id,
    new.owner_id,
    coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = new.owner_id), 'Owner'),
    'owner'
  );

  -- seed default payment modes
  insert into payment_modes (project_id, name, is_default) values
    (new.id, '💳 Card', true),
    (new.id, '📱 UPI', true),
    (new.id, '💵 Cash', true),
    (new.id, '🏦 Net Banking', true),
    (new.id, '🎁 Points / Voucher', true);

  -- seed default categories
  insert into categories (project_id, name, is_default) values
    (new.id, '✈️ Flights', true),
    (new.id, '🚕 Cab / Transport', true),
    (new.id, '🏨 Accommodation', true),
    (new.id, '🍽️ Food & Dining', true),
    (new.id, '🎟️ Entry Tickets', true),
    (new.id, '🛍️ Shopping', true),
    (new.id, '💊 Medical', true),
    (new.id, '📡 Internet / SIM', true),
    (new.id, '🎭 Activities', true),
    (new.id, '🔧 Miscellaneous', true);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created
  after insert on projects
  for each row execute function handle_new_project();

-- ============================================================
-- TRIGGER: keep updated_at fresh on expenses
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger expenses_set_updated_at
  before update on expenses
  for each row execute function set_updated_at();
