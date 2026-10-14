'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowCounterClockwise,
  DotsThreeVertical,
  Trash,
} from '@phosphor-icons/react';
import { archiveCase, deleteCase, unarchiveCase } from '@/app/expedientes/actions';

type Props = {
  caseId: string;
  isArchived: boolean;
  canArchive: boolean;
  canDelete: boolean;
};

export function OperationsRowMenu({ caseId, isArchived, canArchive, canDelete }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`grid h-10 w-10 place-items-center rounded-lg border font-ui transition-[background-color,border-color,color,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62] ${open ? 'border-[#85E4D4]/35 bg-[#85E4D4]/[0.1] text-[#B7F0E6] shadow-[0_0_18px_rgba(133,228,212,0.08)]' : 'border-white/20 bg-transparent text-[#B8C6C1] hover:-translate-y-px hover:border-white/40 hover:bg-white/[0.05] hover:text-white'}`}
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-xl border border-[#85E4D4]/15 bg-[#0B1714]/95 p-2 shadow-[0_24px_64px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <p className="px-2 pb-2 pt-1 font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-[#60736D]">Acciones de operación</p>
          {canArchive ? (
            <form action={isArchived ? unarchiveCase : archiveCase}>
              <input type="hidden" name="case_id" value={caseId} />
              <button type="submit" role="menuitem" className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 font-ui text-xs font-bold text-[#C9D6D1] transition-colors hover:bg-white/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8FF62]">
                {isArchived ? <ArrowCounterClockwise size={16} className="text-[#85E4D4]" /> : <Archive size={16} className="text-[#85E4D4]" />}
                {isArchived ? 'Restaurar operación' : 'Archivar operación'}
              </button>
            </form>
          ) : null}
          {canDelete ? (
            <form
              action={deleteCase}
              onSubmit={(event) => {
                if (!window.confirm('Vas a eliminar esta operación y su contenido interno. Los documentos permanecerán en la Bóveda. Esta acción no se puede deshacer. ¿Continuar?')) event.preventDefault();
              }}
            >
              <input type="hidden" name="case_id" value={caseId} />
              <button type="submit" role="menuitem" className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 font-ui text-xs font-bold text-rose-300 transition-colors hover:bg-rose-400/[0.08] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-300">
                <Trash size={16} /> Eliminar operación
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
