-- ============================================================
-- Academic ERP â€” Supabase Postgres schema with Row Level Security
-- ============================================================

-- ---------- USERS ----------
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  full_name     text not null,
  role          text not null check (role in ('principal','teacher','parent')),
  created_at    timestamptz not null default now()
);

-- ---------- CLASSES ----------
create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  teacher_id    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- STUDENTS ----------
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  roll_no       text unique not null,
  full_name     text not null,
  class_id      uuid references public.classes(id) on delete set null,
  parent_email  text,
  created_at    timestamptz not null default now()
);

-- ---------- MARKS ----------
create table if not exists public.marks (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  subject       text not null,
  exam_name     text not null,
  score         numeric not null check (score >= 0),
  max_score     numeric not null check (max_score > 0),
  entered_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (student_id, subject, exam_name)
);

-- ---------- ATTENDANCE (FN / AN half-days) ----------
create table if not exists public.attendance (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  class_id      uuid references public.classes(id) on delete set null,
  att_date      date not null,
  fn_present    boolean not null default true,
  an_present    boolean not null default true,
  remarks       text default '-',
  marked_by     uuid references public.users(id) on delete set null,
  notified      boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (student_id, att_date)
);

-- ---------- PERMISSION REQUESTS (Teacher -> Principal workflow) ----------
create table if not exists public.permission_requests (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.users(id) on delete cascade,
  request_type  text not null default 'general',
  title         text not null,
  description   text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by    uuid references public.users(id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now()
);

-- ---------- HELPERS ----------
create or replace function public.current_role() returns text
language sql stable as $$ select role from public.users where email = current_setting('request.jwt.claim.email', true) $$;

create or replace function public.current_user_id() returns uuid
language sql stable as $$ select id from public.users where email = current_setting('request.jwt.claim.email', true) $$;

-- ---------- ROW LEVEL SECURITY ----------
alter table public.users                enable row level security;
alter table public.classes              enable row level security;
alter table public.students             enable row level security;
alter table public.marks                enable row level security;
alter table public.attendance           enable row level security;
alter table public.permission_requests  enable row level security;

-- users
drop policy if exists users_read on public.users;
create policy users_read on public.users for select to authenticated using (true);
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users for update using (id = public.current_user_id());
drop policy if exists users_principal_all on public.users;
create policy users_principal_all on public.users for all using (public.current_role() = 'principal');

-- classes: all authenticated read; only principal writes
drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select to authenticated using (true);
drop policy if exists classes_principal_write on public.classes;
create policy classes_principal_write on public.classes for all using (public.current_role() = 'principal');

-- students: everyone reads; principal writes
drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated using (true);
drop policy if exists students_principal_write on public.students;
create policy students_principal_write on public.students for all using (public.current_role() = 'principal');

-- marks: everyone reads; teachers/principal write
drop policy if exists marks_read on public.marks;
create policy marks_read on public.marks for select to authenticated using (true);
drop policy if exists marks_teacher_write on public.marks;
create policy marks_teacher_write on public.marks for all
  using (public.current_role() in ('teacher','principal'))
  with check (public.current_role() in ('teacher','principal'));

-- attendance: everyone reads; teachers/principal write
drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated using (true);
drop policy if exists attendance_teacher_write on public.attendance;
create policy attendance_teacher_write on public.attendance for all
  using (public.current_role() in ('teacher','principal'))
  with check (public.current_role() in ('teacher','principal'));

-- permission_requests: teachers see own; principal sees all & decides
drop policy if exists req_teacher_select on public.permission_requests;
create policy req_teacher_select on public.permission_requests for select
  using (public.current_role() = 'principal' or teacher_id = public.current_user_id());
drop policy if exists req_teacher_insert on public.permission_requests;
create policy req_teacher_insert on public.permission_requests for insert
  with check (public.current_role() = 'teacher' and teacher_id = public.current_user_id());
drop policy if exists req_principal_update on public.permission_requests;
create policy req_principal_update on public.permission_requests for update
  using (public.current_role() = 'principal');

-- ---------- INDEXES ----------
create index if not exists idx_attendance_date on public.attendance(att_date);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_marks_student on public.marks(student_id);
create index if not exists idx_requests_status on public.permission_requests(status);
-- ---------- SEED DEMO DATA (idempotent) ----------
insert into public.users (email, full_name, role)
values
  ('principal@school.edu',  'Dr. Meera Krishnan',  'principal'),
  ('lakshmi@school.edu',    'Mrs. Lakshmi Menon',  'teacher'),
  ('parent.demo@mail.com',  'Demo Parent',         'parent')
on conflict (email) do nothing;

insert into public.classes (name, teacher_id)
select 'Class 10A', u.id from public.users u
where u.email = 'lakshmi@school.edu'
  and not exists (select 1 from public.classes where name = 'Class 10A');

insert into public.students (roll_no, full_name, class_id, parent_email)
select v.roll, v.name, c.id, 'parent.demo@mail.com'
from (values
  ('10A-01','Aarav Kumar'),
  ('10A-02','Ananya Reddy'),
  ('10A-03','Rahul Verma'),
  ('10A-04','Sneha Nair'),
  ('10A-05','Karthik S'),
  ('10A-06','Diya Sharma'),
  ('10A-07','Aditya Rao'),
  ('10A-08','Meera Iyer')
) as v(roll, name)
cross join public.classes c
where c.name = 'Class 10A'
on conflict (roll_no) do nothing;



-- Restrict helper functions: anon must not probe identity helpers
revoke execute on function public.current_role() from anon;
revoke execute on function public.current_user_id() from anon;
