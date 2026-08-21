-- ==========================================
-- SUPABASE CI BASELINE
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;



-- 3. TABLES & COLUMNS
CREATE TABLE public.organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    industry text,
    industry_type text NOT NULL DEFAULT 'general' CHECK (industry_type IN ('general', 'legal', 'escribania', 'gestoria', 'inmobiliaria', 'empresa', 'contable', 'drogueria', 'farma', 'industria', 'compliance', 'seguridad_documental')),
    city text,
    province text,
    plan text NOT NULL DEFAULT 'starter',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL,
    role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'client', 'auditor')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

CREATE TABLE public.platform_admins (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rental_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rent_index_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid REFERENCES public.rental_contracts(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title text NOT NULL,
    client_name text,
    case_type text DEFAULT 'general',
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'active', 'in_review', 'incomplete', 'waiting_client', 'completed', 'archived', 'Activo', 'En trámite', 'Con observaciones', 'Archivado')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_mime_type text,
    file_size bigint,
    document_type text,
    sensitivity_level text DEFAULT 'medium',
    uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    expires_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_outputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
    output_type text NOT NULL CHECK (output_type IN ('summary', 'extraction', 'analysis', 'document_analysis', 'document_poder', 'case_summary', 'case_cotejo', 'case_escritura', 'case_uif')),
    content jsonb,
    model_name text,
    result_json jsonb,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    name text NOT NULL,
    template_type text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
    document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'reviewed', 'not_required')),
    requirement_type text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    industry_type text,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    title text NOT NULL,
    data jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    description text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agenda_plazos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    titulo text NOT NULL,
    fecha date NOT NULL,
    hora time,
    detalle text,
    categoria text NOT NULL,
    estado text NOT NULL DEFAULT 'Pendiente',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
    content text NOT NULL,
    role text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.document_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    chunk_text text NOT NULL,
    embedding vector(768) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_derivations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL,
    invitation_token text,
    status text DEFAULT 'pending',
    invited_by uuid,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3.5 CONTEXT FUNCTIONS (Required for RLS before policies)
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT status = 'active' FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id no puede modificarse';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'Un usuario no puede modificar su propio rol';
    END IF;

    IF NOT public.is_org_admin() THEN
      RAISE EXCEPTION 'Solo un administrador puede modificar roles';
    END IF;

    IF NEW.role = 'admin' THEN
      RAISE EXCEPTION 'Solo el dueno de plataforma puede crear Administradores';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_organization_with_admin_invitation(
  organization_name text,
  administrator_email text,
  platform_owner_id uuid,
  invitation_token_value uuid,
  invitation_expires_at timestamptz
)
RETURNS table (organization_id uuid, invitation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_organization_id uuid;
  new_invitation_id uuid;
  normalized_email text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Operacion exclusiva del servidor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = platform_owner_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Dueno de plataforma no autorizado';
  END IF;

  normalized_email := lower(trim(administrator_email));

  IF nullif(trim(organization_name), '') IS NULL THEN
    RAISE EXCEPTION 'El nombre de la organizacion es obligatorio';
  END IF;

  INSERT INTO public.organizations (name, plan) VALUES (trim(organization_name), 'starter') RETURNING id INTO new_organization_id;

  INSERT INTO public.user_invitations (organization_id, email, role, status, invitation_token, invited_by, expires_at, updated_at)
  VALUES (new_organization_id, normalized_email, 'admin', 'pending', invitation_token_value::text, platform_owner_id, invitation_expires_at, now())
  RETURNING id INTO new_invitation_id;

  INSERT INTO public.audit_logs (organization_id, action, resource_type, resource_id)
  VALUES (new_organization_id, 'organization_created', 'organization', new_organization_id::text);

  RETURN QUERY SELECT new_organization_id, new_invitation_id;
END;
$$;


-- 4. TRIGGERS
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_checklists_updated_at BEFORE UPDATE ON public.checklists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_checklist_items_updated_at BEFORE UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_agenda_plazos_updated_at BEFORE UPDATE ON public.agenda_plazos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER protect_profiles_security BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_security_fields();

-- 5. RLS ENABLEMENT
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_plazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_derivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES
CREATE POLICY "organizations_select_policy" ON public.organizations FOR SELECT USING (id = public.current_user_organization_id() OR public.current_user_role() = 'platform_owner');
CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (organization_id = public.current_user_organization_id() OR public.current_user_role() = 'platform_owner');
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (id = auth.uid() OR (organization_id = public.current_user_organization_id() AND public.current_user_role() = 'admin'));

CREATE POLICY "cases_org_all" ON public.cases FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "documents_org_all" ON public.documents FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "ai_outputs_org_all" ON public.ai_outputs FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "checklists_org_all" ON public.checklists FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "checklist_items_org_all" ON public.checklist_items FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "audit_logs_org_all" ON public.audit_logs FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "reports_org_all" ON public.reports FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "case_events_org_all" ON public.case_events FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "agenda_plazos_org_all" ON public.agenda_plazos FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "agent_messages_org_all" ON public.agent_messages FOR ALL USING (organization_id = public.current_user_organization_id());
CREATE POLICY "document_chunks_org_all" ON public.document_chunks FOR ALL USING (document_id IN (SELECT id FROM public.documents WHERE organization_id = public.current_user_organization_id()));

CREATE POLICY "user_invitations_insert_admin_own_org" ON public.user_invitations FOR INSERT TO authenticated
WITH CHECK (
  public.current_user_is_active() AND public.is_org_admin() AND organization_id = public.current_user_organization_id() AND invited_by = auth.uid() AND role IN ('employee', 'auditor', 'client')
);
CREATE POLICY "user_invitations_update_admin_own_org" ON public.user_invitations FOR UPDATE TO authenticated
USING (
  public.current_user_is_active() AND public.is_org_admin() AND organization_id = public.current_user_organization_id()
) WITH CHECK (
  public.is_org_admin() AND organization_id = public.current_user_organization_id() AND role IN ('employee', 'auditor', 'client')
);

-- 7. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT DO NOTHING;

CREATE POLICY "storage_select_policy" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND (auth.uid() IS NOT NULL));
CREATE POLICY "storage_insert_policy" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND (auth.uid() IS NOT NULL));
CREATE POLICY "storage_delete_policy" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND (auth.uid() IS NOT NULL));

-- 8. GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM public;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- GRANT execute to specific functions needed before migrations
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_security_fields() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_create_organization_with_admin_invitation(text, text, uuid, uuid, timestamptz) TO service_role;

-- END BASELINE
