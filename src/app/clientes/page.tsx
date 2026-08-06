import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient } from '@/lib/permissions/roles';
import { MotionCard } from '@/components/ui/MotionCard';
import { Badge } from '@/components/ui/Badge';
import { Users } from 'lucide-react';
import { 
  getClientStatusLabel, 
  getClientTypeLabel, 
  getOperationInterestLabel, 
  getDesiredPropertyTypeLabel 
} from '@/lib/clients/labels';

export default async function ClientesPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: clientsData, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const clients = clientsData || [];
  const canManage = canManageClient(profile.role);

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white">
            Clientes e interesados
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Gestioná la cartera de clientes y sus criterios de búsqueda.
          </p>
        </div>
        {canManage && (
          <Link
            href="/clientes/nuevo"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#0A1830]"
          >
            Nuevo cliente
          </Link>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-500/50" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            Aún no tenés clientes registrados
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Comenzá agregando un nuevo contacto o interesado a tu base de datos.
          </p>
          {canManage && (
            <Link
              href="/clientes/nuevo"
              className="mt-6 inline-block rounded-xl bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Cargar el primer cliente
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client, index) => {
            const hasSearchCriteria = client.operation_interest || client.desired_property_type || client.zone;
            const searchSummary = hasSearchCriteria 
              ? `Busca: ${getDesiredPropertyTypeLabel(client.desired_property_type)} ${client.operation_interest ? 'en ' + getOperationInterestLabel(client.operation_interest).toLowerCase() : ''} ${client.zone ? 'en ' + client.zone : ''}`
              : 'Sin criterios de búsqueda específicos';
            
            let budgetSummary = '';
            if (client.budget_max) {
               budgetSummary = ` · ${client.currency === 'USD' ? 'u$s' : '$'}${client.budget_max.toLocaleString('es-AR')}`;
            }
            if (client.min_rooms) {
               budgetSummary += ` · ${client.min_rooms}+ amb`;
            }

            return (
              <Link key={client.id} href={`/clientes/${client.id}`} className="block outline-none">
                <MotionCard
                  index={index}
                  className="group relative flex h-full flex-col justify-between overflow-hidden p-6 transition-all hover:border-cyan-500/50 hover:bg-white/[0.04]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {client.name}
                      </h3>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge tone={client.status === 'activo' ? 'success' : client.status === 'en_seguimiento' ? 'warning' : 'neutral'}>
                          {getClientStatusLabel(client.status)}
                        </Badge>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          {getClientTypeLabel(client.client_type)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 border-t border-white/5 pt-4">
                      <p className="text-sm font-medium text-slate-300 truncate">
                        {searchSummary}{budgetSummary}
                      </p>
                      {(client.phone || client.email) && (
                        <p className="mt-2 text-xs text-slate-500 truncate">
                          {client.phone} {client.phone && client.email ? '·' : ''} {client.email}
                        </p>
                      )}
                    </div>
                  </div>
                </MotionCard>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
