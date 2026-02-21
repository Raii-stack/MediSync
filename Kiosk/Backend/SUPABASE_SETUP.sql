-- ==========================================
-- 1. CONFIGURATION & EXTENSIONS
-- ==========================================
create extension if not exists "uuid-ossp";

-- ==========================================
-- 2. CORE IDENTITY TABLES (Green in ERD)
-- ==========================================

-- Staff who manage the dashboard and receive alerts.
create table public.clinic_staff (
  id uuid default uuid_generate_v4() primary key,
  employee_id text unique not null,
  first_name text not null,
  last_name text not null,
  role text check (role in ('Admin', 'Nurse', 'Doctor')) default 'Nurse',
  password text not null, -- (Hash this in production!)
  is_active boolean default true,
  last_login timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- The master list of students.
create table public.students (
  id uuid default uuid_generate_v4() primary key,
  student_id text unique not null, -- School ID (e.g., 2024-001)
  rfid_uid text unique not null,   -- Card ID
  first_name text not null,
  last_name text not null,
  age int,
  grade_level int,
  section text,
  created_at timestamp with time zone default now()
);

-- Sensitive info linked 1:1 to Students.
create table public.medical_history (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id) on delete cascade unique,
  blood_type text,
  allergies text,
  medical_conditions text,
  current_medications text,
  emgr_contact_name text,
  emgr_contact_no text,
  last_updated timestamp with time zone default now()
);

-- Keeps track of your machines (e.g., "Kiosk 1 is in Room 301").
create table public.kiosks (
  kiosk_id text primary key, -- e.g., "KIOSK-01"
  room_assigned text not null,
  status text default 'Online'
);

-- ==========================================
-- 3. TRANSACTIONAL TABLES (Red in ERD)
-- ==========================================

-- Cloud mirror of what is inside each machine.
create table public.kiosk_inventory (
  id uuid default uuid_generate_v4() primary key,
  kiosk_id text references public.kiosks(kiosk_id),
  medicine_name text not null,
  current_stock int default 0,
  last_synced timestamp with time zone default now(),
  unique(kiosk_id, medicine_name) -- Prevent duplicates
);
 
 
create table public.medicines_library (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  description text,
  symptoms_target jsonb, 
  image_url text,
  created_at timestamp with time zone default now()
);

-- Real-time alerts sent from Kiosks.
create table public.emergency_alerts (
  id uuid default uuid_generate_v4() primary key,
  kiosk_id text references public.kiosks(kiosk_id),
  student_id uuid references public.students(id), -- Nullable (if anonymous)
  alert_message text,
  alert_status text default 'PENDING', -- PENDING, RESOLVED
  created_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone
);

-- The raw history of every tap and dispense.
create table public.kiosk_logs (
  id uuid default uuid_generate_v4() primary key,
  kiosk_id text references public.kiosks(kiosk_id),
  student_id uuid references public.students(id),
  unregistered_rfid_uid text,
  symptoms_reported jsonb, -- Stores ["Headache", "Fever"]
  pain_scale int,          -- Fixed: Changed from text to int
  temp_reading decimal(4,1), -- Fixed: Changed to decimal
  heart_rate_bpm int,
  medicine_dispensed text,
  created_at timestamp with time zone default now(),
  unregistered_rfid_uid text
);

-- The official medical record (Manual + Automated).
create table public.clinic_visits (
  id uuid default uuid_generate_v4() primary key,
  student_id uuid references public.students(id),
  visit_source text check (visit_source in ('Kiosk', 'Walk-in', 'Emergency')),
  kiosk_id text references public.kiosks(kiosk_id),
  attended_by uuid references public.clinic_staff(id), -- Null if Kiosk
  diagnosis text,
  treatment_given text,
  nurse_notes text,
  visit_date timestamp with time zone default now()
);

-- ==========================================
-- 4. SECURITY (Row Level Security)
-- ==========================================
alter table public.students enable row level security;
alter table public.medical_history enable row level security;
alter table public.clinic_visits enable row level security;

-- (For MVP, allow public access. Lock this down before production!)
create policy "Public Access" on public.students for all using (true);
create policy "Public Access" on public.medical_history for all using (true);
create policy "Public Access" on public.clinic_visits for all using (true);
create policy "Public Access" on public.kiosk_logs for all using (true);
create policy "Public Access" on public.kiosk_inventory for all using (true);
create policy "Public Access" on public.emergency_alerts for all using (true);
create policy "Public Access" on public.clinic_staff for all using (true);
create policy "Public Access" on public.kiosks for all using (true);