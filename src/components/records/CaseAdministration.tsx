import { DotsThreeVertical } from '@phosphor-icons/react/dist/ssr';
import { archiveCase, unarchiveCase, deleteCase } from '@/app/expedientes/actions';
import { type UserRole, canArchiveCase, canDeleteCase } from '@/lib/permissions/roles';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { DeleteCaseButton } from '@/app/expedientes/[id]/DeleteCaseButton';
import { AppButton } from '@/components/ui/AppButton';
import { RecordDialog } from './RecordDialog';

/** Mismas guardas, acciones y confirmación de la ficha; solo cambia su ubicación. */
export function CaseAdministration({ caseId, status, role, industry }: { caseId:string; status:string; role:UserRole; industry:IndustryType }) {
  if (!canArchiveCase(role) && !canDeleteCase(role)) return null;
  const terms = getIndustryTerms(industry);
  return <RecordDialog trigger={<><DotsThreeVertical size={16} aria-hidden />Administrar</>} title="Administrar registro">
    <p>Acciones separadas de la lectura y del trabajo documental.</p>
    <div>
      {canArchiveCase(role) ? status !== 'archived' ? <form action={archiveCase}>
        <input type="hidden" name="case_id" value={caseId} />
        <AppButton type="submit" variant="secondary">{terms.archivarCta}</AppButton>
      </form> : <form action={unarchiveCase}>
        <input type="hidden" name="case_id" value={caseId} />
        <AppButton type="submit" variant="secondary">Desarchivar</AppButton>
      </form> : null}
      {canDeleteCase(role) ? <form action={deleteCase}>
        <input type="hidden" name="case_id" value={caseId} />
        <DeleteCaseButton confirmText={`Vas a borrar este ${terms.expedienteSingular.toLowerCase()} y todo su contenido interno (checklist, cronología, análisis de IA y agenda). Los documentos quedan guardados en la Bóveda. Esta acción no se puede deshacer. ¿Continuar?`} />
      </form> : null}
    </div>
  </RecordDialog>;
}
