'use server';

import { redirect, unstable_rethrow } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageProperty, isUserRole } from '@/lib/permissions/roles';
import { createProperty } from '../actions';
import { prepareCreationPayload, type CreationState } from './propertyCreation';

export async function createNewProperty(_previous: CreationState, source: FormData): Promise<CreationState> {
  // Match the existing server guards before returning validation; the delegated
  // action also retains its own authorization, organization, audit and redirect.
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageProperty(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }
  const prepared = prepareCreationPayload(source);
  if (prepared.state.error) return prepared.state;
  try {
    await createProperty(prepared.data);
    // Successful createProperty exits through Next's redirect, never this branch.
    return { error: 'No se pudo confirmar el resultado del guardado. Revisá el listado antes de volver a intentar para evitar duplicados.', field: null };
  } catch (error) {
    // Do not swallow redirect/notFound/dynamic rendering control exceptions.
    unstable_rethrow(error);
    // An audit/revalidation failure can happen after an insert. Do not promise
    // rollback or encourage blindly retrying, and never expose provider details.
    return { error: 'No se pudo confirmar el resultado del guardado. Revisá el listado antes de volver a intentar para evitar duplicados. Tus datos se conservan.', field: null };
  }
}
