
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('manufacturer','distributor','pharmacy','consumer','admin');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  company_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'company_name'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Medicines
CREATE TABLE public.medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL UNIQUE,             -- public unique ID embedded in QR
  qr_secret text NOT NULL,                     -- private signing secret for dynamic QR
  name text NOT NULL,
  batch_number text NOT NULL,
  manufacture_date date NOT NULL,
  expiry_date date NOT NULL,
  manufacturer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manufacturer_name text NOT NULL,
  reference_image_path text,                   -- storage path
  reference_phash text,                        -- 64-bit perceptual hash hex
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read medicines" ON public.medicines FOR SELECT USING (true);
CREATE POLICY "Manufacturers insert own medicines" ON public.medicines
  FOR INSERT WITH CHECK (auth.uid() = manufacturer_id AND public.has_role(auth.uid(),'manufacturer'));
CREATE POLICY "Manufacturers update own medicines" ON public.medicines
  FOR UPDATE USING (auth.uid() = manufacturer_id);

-- Supply chain events
CREATE TABLE public.supply_chain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  actor_role app_role NOT NULL,
  actor_name text NOT NULL,
  event_type text NOT NULL,        -- 'manufactured' | 'shipped' | 'received' | 'dispensed'
  location text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supply_chain_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sce_medicine ON public.supply_chain_events(medicine_id, created_at);

CREATE POLICY "Anyone reads supply chain" ON public.supply_chain_events FOR SELECT USING (true);
CREATE POLICY "Distributors/pharmacies/manufacturers add events" ON public.supply_chain_events
  FOR INSERT WITH CHECK (
    auth.uid() = actor_id AND (
      public.has_role(auth.uid(),'distributor') OR
      public.has_role(auth.uid(),'pharmacy') OR
      public.has_role(auth.uid(),'manufacturer')
    )
  );

-- Scan logs
CREATE TABLE public.scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  scanner_id uuid REFERENCES auth.users(id),
  location text,
  ip_hash text,
  user_agent text,
  trust_score int,
  status text,           -- genuine | suspicious | fake
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_scan_medicine ON public.scan_logs(medicine_id, created_at);
CREATE INDEX idx_scan_pid ON public.scan_logs(product_id, created_at);

CREATE POLICY "Anyone reads scan logs" ON public.scan_logs FOR SELECT USING (true);
CREATE POLICY "Anyone may insert scan log" ON public.scan_logs FOR INSERT WITH CHECK (true);

-- Tamper-evident hash-chained ledger (the "blockchain")
CREATE TABLE public.ledger (
  id bigserial PRIMARY KEY,
  medicine_id uuid REFERENCES public.medicines(id) ON DELETE CASCADE,
  block_type text NOT NULL,   -- 'genesis' | 'supply_event' | 'image_anchor'
  payload jsonb NOT NULL,
  prev_hash text NOT NULL,
  block_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ledger_medicine ON public.ledger(medicine_id, id);

CREATE POLICY "Anyone reads ledger" ON public.ledger FOR SELECT USING (true);
-- No insert/update/delete policies → only edge functions with service role can write

-- Storage bucket for medicine reference images
INSERT INTO storage.buckets (id, name, public) VALUES ('medicine-images','medicine-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read medicine images" ON storage.objects FOR SELECT USING (bucket_id = 'medicine-images');
CREATE POLICY "Authenticated upload medicine images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'medicine-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Owners update medicine images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'medicine-images' AND auth.uid()::text = (storage.foldername(name))[1]);
