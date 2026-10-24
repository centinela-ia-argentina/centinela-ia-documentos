'use client';
import { Archive, ArrowCounterClockwise, DotsThreeVertical, Trash } from '@phosphor-icons/react';
import { archiveCase, deleteCase, unarchiveCase } from '@/app/expedientes/actions';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';
import { AppButton } from '@/components/ui/AppButton';
import { RecordDialog } from '@/components/records/RecordDialog';

type Props = { caseId:string; title?:string; industry?:IndustryType; isArchived:boolean; canArchive:boolean; canDelete:boolean };
export function OperationsRowMenu({caseId,title,industry='inmobiliaria',isArchived,canArchive,canDelete}:Props) {
  const terms = getIndustryTerms(industry);
  const property = industry === 'inmobiliaria';
  if (!canArchive && !canDelete) return null;
  return <RecordDialog trigger={<DotsThreeVertical size={18} aria-hidden />} triggerLabel={title ? `Más acciones: ${title}` : 'Más acciones'} title={title ? `Administrar · ${title}` : `Administrar ${terms.expedienteSingular.toLowerCase()}`} compact>
    <p>Acciones del registro. Los documentos permanecen en la Bóveda si lo eliminás.</p>
    <div>
      {canArchive ? <form action={isArchived ? unarchiveCase : archiveCase}>
        <input type="hidden" name="case_id" value={caseId} />
        <AppButton type="submit" variant="secondary">{isArchived ? <ArrowCounterClockwise size={16} aria-hidden /> : <Archive size={16} aria-hidden />}{property ? isArchived ? 'Restaurar operación' : 'Archivar operación' : isArchived ? 'Desarchivar' : 'Archivar'}</AppButton>
      </form> : null}
      {canDelete ? <form action={deleteCase} onSubmit={event => {
        const confirmText = property ? 'Vas a eliminar esta operación y su contenido interno. Los documentos permanecerán en la Bóveda. Esta acción no se puede deshacer. ¿Continuar?' : `Vas a borrar este ${terms.expedienteSingular.toLowerCase()} y todo su contenido interno (checklist, cronología, análisis de IA y agenda). Los documentos quedan guardados en la Bóveda. Esta acción no se puede deshacer. ¿Continuar?`;
        if (!window.confirm(confirmText)) event.preventDefault();
      }}>
        <input type="hidden" name="case_id" value={caseId} />
        <AppButton type="submit" variant="destructive"><Trash size={16} aria-hidden />{property ? 'Eliminar operación' : 'Eliminar'}</AppButton>
      </form> : null}
    </div>
  </RecordDialog>;
}
