
create extension if not exists "uuid-ossp";

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
  student_id text unique not null, 
  rfid_uid text unique not null,   
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
  student_id text references public.students(student_id) on delete cascade unique,
  blood_type text,
  allergies text,
  medical_conditions text,
  current_medications text,
  emgr_contact_name text,
  emgr_contact_no text,
  last_updated timestamp with time zone default now()
);

create table public.kiosks (
  kiosk_id text primary key, 
  room_assigned text not null,
  status text default 'Online'
);

-- Cloud mirror of what is inside each machine.
create table public.kiosk_inventory (
  id uuid default uuid_generate_v4() primary key,
  kiosk_id text references public.kiosks(kiosk_id),
  slot_id int not null,
  medicine_name text not null,
  current_stock int default 0,
  max_stock int default 50,
  last_synced timestamp with time zone default now(),
  unique(kiosk_id, slot_id) 
);
 
create table public.medicines_library (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null,
  description text,
  symptoms_target jsonb, 
  created_at timestamp with time zone default now()
);

create table public.emergency_alerts (
  id uuid default uuid_generate_v4() primary key,
  kiosk_id text references public.kiosks(kiosk_id),
  rfid_uid text, 
  alert_message text,
  alert_status text default 'PENDING', 
  created_at timestamp with time zone default now(),
  confirmed_at timestamp with time zone
);

-- The raw history of every tap and dispense.
create table public.kiosk_logs (
  id uuid default uuid_generate_v4() primary key,
  kiosk_id text references public.kiosks(kiosk_id),
  rfid_uid text,
  symptoms_reported jsonb, 
  pain_scale int,          
  temp_reading decimal(4,1), 
  heart_rate_bpm int,
  medicine_dispensed text,
  created_at timestamp with time zone default now()
);

-- The official medical record (Manual + Automated).
create table public.clinic_visits (
  id uuid default uuid_generate_v4() primary key,
  student_id text references public.students(student_id),
  visit_source text check (visit_source in ('Kiosk', 'Walk-in', 'Emergency')),
  kiosk_id text references public.kiosks(kiosk_id),
  attended_by text references public.clinic_staff(employee_id), 
  diagnosis text,
  treatment_given text,
  nurse_notes text,
  visit_date timestamp with time zone default now()
);