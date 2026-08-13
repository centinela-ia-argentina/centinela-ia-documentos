export interface ComparableRecord {
  id: string;
  organization_id: string;
  property_id?: string | null;
  property_type: string | null;
  province?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  subzone?: string | null;
  address?: string | null;
  surface_total_m2?: number | null;
  surface_covered_m2?: number | null;
  rooms?: number | null;
  price: number;
  currency: string;
  source_name?: string | null;
  source_url?: string | null;
  reference_date?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}
