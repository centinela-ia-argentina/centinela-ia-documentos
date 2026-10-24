import { derivarAEscribania } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { DerivationView } from './DerivationView';

export async function DerivarEscribania({ caseId }: { caseId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_derivations')
    .select('id, to_email, status, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  const items = data ?? [];

  return <DerivationView caseId={caseId} items={items} action={derivarAEscribania} />;
}
