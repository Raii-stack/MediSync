-- ============================================================================
-- SUPABASE SQL SCHEMA FOR MEDISYNC
-- Run this entire script in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- 1. TABLE: clinic_visits (Log of all medicine dispensed)
CREATE TABLE
  public.clinic_visits (
    id bigint primary key generated always as identity,
    kiosk_id text not null default 'kiosk-001',
    student_id text,
    symptoms text,
    pain_level integer,
    medicine_dispensed text not null,
    dispensed_at timestamp with time zone not null default now(),
    created_at timestamp with time zone not null default now()
  );

-- 2. TABLE: kiosk_inventory (Current stock levels synced from kiosk)
CREATE TABLE
  public.kiosk_inventory (
    id bigint primary key generated always as identity,
    kiosk_id text not null default 'kiosk-001',
    medicine_name text not null unique,
    current_stock integer not null,
    max_stock integer not null,
    last_synced timestamp with time zone not null default now(),
    created_at timestamp with time zone not null default now()
  );

-- 3. TABLE: emergency_alerts (Store emergency alerts temporarily)
CREATE TABLE
  public.emergency_alerts (
    id bigint primary key generated always as identity,
    kiosk_id text not null default 'kiosk-001',
    room_number text not null,
    alert_status text not null default 'pending', -- 'pending' or 'confirmed'
    alert_message text,
    created_at timestamp with time zone not null default now(),
    confirmed_at timestamp with time zone
  );

-- 4. Enable Row Level Security (Optional but recommended)
ALTER TABLE public.clinic_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies (Allow all for dev - restrict in production)
CREATE POLICY "Allow all on clinic_visits" ON public.clinic_visits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on kiosk_inventory" ON public.kiosk_inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on emergency_alerts" ON public.emergency_alerts FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- Done! You can now use Supabase from your sync.js script
-- ============================================================================
