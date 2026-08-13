export interface ClientRecord {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  client_type: string | null;
  operation_interest: string | null;
  desired_property_type: string | null;
  zone: string | null;
  desired_province?: string | null;
  desired_city?: string | null;
  desired_neighborhood?: string | null;
  desired_subzone?: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  min_rooms: number | null;
  status: string | null;
  notes: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
