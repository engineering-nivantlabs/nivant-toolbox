-- Example business tables the templates query with data.query / data.enrich.
-- In a real deployment these are the client's own tables (point
-- DATA_DATABASE_URL at their database and adjust the SQL in each workflow).

CREATE TABLE IF NOT EXISTS listings (id serial PRIMARY KEY, title text, area text, bedrooms int, rent numeric, sqft int, features text, status text DEFAULT 'available');

CREATE TABLE IF NOT EXISTS appointments (id serial PRIMARY KEY, patient_name text, phone text, service text, practitioner text, starts_at timestamptz, status text DEFAULT 'booked');
CREATE TABLE IF NOT EXISTS waitlist (id serial PRIMARY KEY, patient_name text, phone text, service text, created_at timestamptz DEFAULT now(), active boolean DEFAULT true);

CREATE TABLE IF NOT EXISTS invoices (id serial PRIMARY KEY, number text, customer_name text, email text, phone text, amount numeric, currency text DEFAULT 'USD', due_date date, status text DEFAULT 'open', disputed boolean DEFAULT false);

CREATE TABLE IF NOT EXISTS programs (id serial PRIMARY KEY, name text, schedule text, format text, fee numeric, audience text, description text);
CREATE TABLE IF NOT EXISTS counsellors (key text PRIMARY KEY, name text, email text, specialty text, open_leads int DEFAULT 0);

CREATE TABLE IF NOT EXISTS enrolments (id serial PRIMARY KEY, program text, amount numeric, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS ad_spend (day date, channel text, amount numeric, leads int);

CREATE TABLE IF NOT EXISTS members (id serial PRIMARY KEY, name text, phone text, email text, plan text, status text DEFAULT 'active', stripe_customer text);

CREATE TABLE IF NOT EXISTS jobs (id serial PRIMARY KEY, customer_name text, phone text, service text, technician text, status text DEFAULT 'scheduled', completed_at timestamptz);

CREATE TABLE IF NOT EXISTS menu_packages (name text PRIMARY KEY, per_head numeric, min_guests int, max_guests int, description text, vegetarian_ok boolean DEFAULT true);
CREATE TABLE IF NOT EXISTS catering_events (id serial PRIMARY KEY, event_date date, guests int, client text);

CREATE TABLE IF NOT EXISTS orders (number text PRIMARY KEY, customer_name text, phone text, email text, status text, shipped_at timestamptz, carrier text, tracking_number text, items jsonb DEFAULT '[]');

CREATE TABLE IF NOT EXISTS clients (id serial PRIMARY KEY, name text, contact_name text, email text, type text);
CREATE TABLE IF NOT EXISTS document_checklists (client_type text, item text, description text, PRIMARY KEY (client_type, item));

CREATE TABLE IF NOT EXISTS policies (id serial PRIMARY KEY, client_name text, email text, phone text, type text, insurer text, premium numeric, renewal_premium numeric, renews_on date, claims_count int DEFAULT 0);

CREATE TABLE IF NOT EXISTS vehicles (id serial PRIMARY KEY, customer_name text, phone text, make_model text, last_service_at date, last_service_km int, km_per_day numeric, next_service_km int, advisor text);

CREATE TABLE IF NOT EXISTS reservations (id serial PRIMARY KEY, guest_name text, phone text, language text, arrival date, nights int, guests int, notes text, flight_arrival text, status text DEFAULT 'confirmed');
CREATE TABLE IF NOT EXISTS upsells (key text PRIMARY KEY, name text, price numeric, description text);

CREATE TABLE IF NOT EXISTS products (sku text PRIMARY KEY, name text, unit text, price numeric, stock int);
CREATE TABLE IF NOT EXISTS trade_customers (phone text PRIMARY KEY, name text, credit_limit numeric, balance numeric DEFAULT 0);
