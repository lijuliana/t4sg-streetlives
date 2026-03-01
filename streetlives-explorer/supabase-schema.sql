-- ============================================================
-- STREETLIVES SERVICE EXPLORER
-- Supabase Database Schema, RLS Policies & Seed Data
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. TABLES
-- ============================================================

-- Categories
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Services
CREATE TABLE services (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  borough            TEXT NOT NULL,
  address            TEXT,
  phone              TEXT,
  website            TEXT,
  eligibility        TEXT,
  hours              TEXT,
  last_verified_date DATE,
  is_active          BOOLEAN DEFAULT true,
  updated_at         TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Junction table: service <-> category (many-to-many)
CREATE TABLE service_categories (
  service_id  UUID REFERENCES services(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, category_id)
);

-- Auto-update updated_at on services
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_updated_at_trigger
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- 2. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Public (anon) read access
CREATE POLICY "Public can read categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read active services"
  ON services FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR auth.role() = 'authenticated');

CREATE POLICY "Public can read service_categories"
  ON service_categories FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated write access
CREATE POLICY "Auth users can insert services"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth users can update services"
  ON services FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Auth users can insert service_categories"
  ON service_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth users can delete service_categories"
  ON service_categories FOR DELETE
  TO authenticated
  USING (true);

-- 3. SEED DATA
-- ============================================================

-- Categories
INSERT INTO categories (id, slug, name) VALUES
  ('a1a1a1a1-0001-4000-8000-000000000001', 'housing',    'Housing'),
  ('a1a1a1a1-0002-4000-8000-000000000002', 'food',       'Food'),
  ('a1a1a1a1-0003-4000-8000-000000000003', 'legal',      'Legal'),
  ('a1a1a1a1-0004-4000-8000-000000000004', 'health',     'Health'),
  ('a1a1a1a1-0005-4000-8000-000000000005', 'safety',     'Safety'),
  ('a1a1a1a1-0006-4000-8000-000000000006', 'employment', 'Employment');

-- Services
INSERT INTO services (id, name, description, borough, address, phone, website, eligibility, hours, last_verified_date) VALUES
  ('b2b2b2b2-0001-4000-8000-000000000001',
   'Beacon Youth Shelter Intake',
   'Open intake for youth ages 16–24 experiencing homelessness. Provides emergency overnight beds, case management referrals, and connection to transitional housing programs. Walk-ins accepted daily from 4 PM–8 PM. Staff fluent in English and Spanish.',
   'Manhattan',
   '412 W 129th St, New York, NY 10027', '212-555-0101', 'https://example.org/beacon-youth',
   'Youth ages 16–24. No ID required for initial intake.',
   'Mon–Sun 4:00 PM – 8:00 PM (intake), 24hr shelter',
   '2025-11-15'),

  ('b2b2b2b2-0002-4000-8000-000000000002',
   'Flatbush Community Pantry',
   'Weekly food distribution serving 500+ families. Fresh produce, shelf-stable goods, and hygiene kits available. No documentation required. Culturally diverse offerings including halal and Caribbean staples.',
   'Brooklyn',
   '1820 Flatbush Ave, Brooklyn, NY 11210', '718-555-0202', NULL,
   'Open to all. No documentation required.',
   'Saturdays 9:00 AM – 1:00 PM',
   '2025-12-01'),

  ('b2b2b2b2-0003-4000-8000-000000000003',
   'Queens Legal Aid Clinic',
   'Free legal consultations for housing court, immigration, and benefits appeals. Attorneys available for same-day walk-in appointments. Interpretation services in 12 languages. Can assist with SNAP, Medicaid, and SSI applications.',
   'Queens',
   '89-14 Parsons Blvd, Jamaica, NY 11432', '718-555-0303', 'https://example.org/queens-legal',
   'NYC residents with income below 200% FPL.',
   'Mon–Fri 9:00 AM – 5:00 PM',
   '2025-10-20'),

  ('b2b2b2b2-0004-4000-8000-000000000004',
   'Bronx Mobile Health Van',
   'Free mobile clinic offering primary care, vaccinations, blood pressure screenings, and rapid HIV/STI testing. No appointment needed. The van rotates between four Bronx locations weekly. Staffed by licensed nurse practitioners.',
   'Bronx',
   NULL, '718-555-0404', 'https://example.org/bronx-health-van',
   'Open to all. No insurance required.',
   'Tue & Thu 10:00 AM – 4:00 PM (rotating locations)',
   '2025-12-10'),

  ('b2b2b2b2-0005-4000-8000-000000000005',
   'Safe Sleep Hotline',
   '24/7 phone line connecting individuals to emergency overnight shelter beds across NYC. Operators can locate available beds in real-time and arrange transportation via city services. Multilingual operators available.',
   'Manhattan',
   NULL, '212-555-0505', NULL,
   'Anyone in NYC experiencing homelessness.',
   '24/7',
   '2025-11-28'),

  ('b2b2b2b2-0006-4000-8000-000000000006',
   'Benefits Navigator Desk',
   'One-on-one assistance applying for public benefits including Medicaid, SNAP, HEAP, and Cash Assistance. Trained navigators help with paperwork, recertifications, and appeals. Also provides health insurance enrollment support during open enrollment.',
   'Brooklyn',
   '250 Livingston St, Brooklyn, NY 11201', '718-555-0606', 'https://example.org/benefits-nav',
   'NYC residents. Priority for uninsured individuals.',
   'Mon–Fri 8:30 AM – 4:30 PM',
   '2025-09-30'),

  ('b2b2b2b2-0007-4000-8000-000000000007',
   'Job Readiness Lab',
   'Free computer lab and career coaching center. Offers resume building workshops, interview prep, digital literacy classes, and direct connections to employers hiring for entry-level positions. Includes a professional clothing closet.',
   'Queens',
   '37-02 Northern Blvd, Long Island City, NY 11101', '718-555-0707', 'https://example.org/job-lab',
   'Adults 18+. Must complete intake form.',
   'Mon–Fri 10:00 AM – 6:00 PM, Sat 10:00 AM – 2:00 PM',
   '2025-11-05'),

  ('b2b2b2b2-0008-4000-8000-000000000008',
   'Concourse Drop-In Center',
   'Low-barrier drop-in center providing showers, laundry, meals, mail services, and a safe indoor space. Social workers on-site for case management. Connects guests to shelter placement, medical care, and mental health services. Harm reduction supplies available.',
   'Bronx',
   '880 Grand Concourse, Bronx, NY 10451', '718-555-0808', 'https://example.org/concourse-dropin',
   'Open to all adults. No sobriety requirement.',
   'Mon–Sat 7:00 AM – 7:00 PM',
   '2025-12-05'),

  ('b2b2b2b2-0009-4000-8000-000000000009',
   'SI Street Outreach Team',
   'Mobile outreach workers canvassing Staten Island to connect unsheltered individuals with services. Team provides water, snacks, hygiene kits, and warm clothing. Can facilitate immediate shelter placement and transportation to intake centers.',
   'Staten Island',
   NULL, '718-555-0909', NULL,
   'Individuals living unsheltered on Staten Island.',
   'Mon–Fri 6:00 AM – 2:00 PM',
   '2025-10-15'),

  ('b2b2b2b2-0010-4000-8000-000000000010',
   'ID Replacement Pop-Up',
   'Monthly pop-up event helping individuals obtain replacement birth certificates, state IDs, and Social Security cards. Photographers on-site for ID photos. Staff assists with form completion and fee waivers. Partnered with NYC HRA.',
   'Manhattan',
   '33 Beaver St, New York, NY 10004', '212-555-1010', 'https://example.org/id-popup',
   'NYC residents without valid ID. Fee waivers available.',
   'First Saturday of each month, 9:00 AM – 3:00 PM',
   '2025-11-02');

-- Service ↔ Category links
INSERT INTO service_categories (service_id, category_id) VALUES
  -- Beacon Youth Shelter → Housing
  ('b2b2b2b2-0001-4000-8000-000000000001', 'a1a1a1a1-0001-4000-8000-000000000001'),
  -- Flatbush Community Pantry → Food
  ('b2b2b2b2-0002-4000-8000-000000000002', 'a1a1a1a1-0002-4000-8000-000000000002'),
  -- Queens Legal Aid → Legal
  ('b2b2b2b2-0003-4000-8000-000000000003', 'a1a1a1a1-0003-4000-8000-000000000003'),
  -- Bronx Mobile Health Van → Health
  ('b2b2b2b2-0004-4000-8000-000000000004', 'a1a1a1a1-0004-4000-8000-000000000004'),
  -- Safe Sleep Hotline → Safety
  ('b2b2b2b2-0005-4000-8000-000000000005', 'a1a1a1a1-0005-4000-8000-000000000005'),
  -- Benefits Navigator → Legal + Health (multi-category)
  ('b2b2b2b2-0006-4000-8000-000000000006', 'a1a1a1a1-0003-4000-8000-000000000003'),
  ('b2b2b2b2-0006-4000-8000-000000000006', 'a1a1a1a1-0004-4000-8000-000000000004'),
  -- Job Readiness Lab → Employment
  ('b2b2b2b2-0007-4000-8000-000000000007', 'a1a1a1a1-0006-4000-8000-000000000006'),
  -- Concourse Drop-In → Housing + Health + Safety (multi-category)
  ('b2b2b2b2-0008-4000-8000-000000000008', 'a1a1a1a1-0001-4000-8000-000000000001'),
  ('b2b2b2b2-0008-4000-8000-000000000008', 'a1a1a1a1-0004-4000-8000-000000000004'),
  ('b2b2b2b2-0008-4000-8000-000000000008', 'a1a1a1a1-0005-4000-8000-000000000005'),
  -- SI Street Outreach → Housing + Safety (multi-category)
  ('b2b2b2b2-0009-4000-8000-000000000009', 'a1a1a1a1-0001-4000-8000-000000000001'),
  ('b2b2b2b2-0009-4000-8000-000000000009', 'a1a1a1a1-0005-4000-8000-000000000005'),
  -- ID Replacement Pop-Up → Legal
  ('b2b2b2b2-0010-4000-8000-000000000010', 'a1a1a1a1-0003-4000-8000-000000000003');