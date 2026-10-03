import { derivarAEscribania } from '../actions';
import { createClient } from '@/lib/supabase/server';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  revocada: 'Revocada',
};

export async function DerivarEscribania({ caseId }: { caseId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_derivations')
    .select('id, to_email, status, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  const items = data ?? [];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">🤝 Derivar a Escribanía</h2>
        <p className="mt-1 text-sm text-slate-400">
          Enviá esta operación a una escribanía con acceso colaborativo limitado (visualización de antecedentes y carga de documentación complementaria).
        </p>
      </div>

      <form action={derivarAEscribania} className="space-y-3">
        <input type="hidden" name="case_id" value={caseId} />
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Email de la escribanía</label>
          <input name="to_email" type="email" required placeholder="escribania@ejemplo.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Mensaje (opcional)</label>
          <input name="mensaje" type="text" placeholder="Nota para la escribanía"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none" />
        </div>
        <FormSubmitButton label="Derivar a Escribanía →" loadingLabel="Derivando..." />
      </form>

      {items.length > 0 && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Derivaciones de esta operación</p>
          <ul className="space-y-2">
            {items.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="text-sm text-slate-200">{d.to_email}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300">{ESTADO_LABEL[d.status] ?? d.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
