'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { archiveCase, unarchiveCase, deleteCase } from './actions';

import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { IndustryType } from '@/lib/industries/documentTypes';

interface CaseCardMenuProps {
  industry: string;
  caseId: string;
  isArchived: boolean;
  canArchive: boolean;
  canDelete: boolean;
}

export function CaseCardMenu({ caseId, isArchived, canArchive, canDelete, industry }: CaseCardMenuProps) {
  const terms = getIndustryTerms(industry as IndustryType);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const preventNavigation = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't preventDefault here for form submissions, otherwise they won't submit!
    // We only prevent bubbling so the parent Link doesn't trigger.
  };

  return (
    <div className="absolute right-3 top-3 z-10" ref={menuRef}>
      <button
        onClick={handleToggle}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a8f94] transition-colors hover:bg-[#f1f1ef] hover:text-[#25272a]"
        aria-label="Opciones de la operación"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-48 overflow-hidden rounded-[10px] border border-[#d9d9d6] bg-white shadow-lg"
          onClick={preventNavigation}
        >
          <div className="flex flex-col py-1">
            {canArchive && !isArchived && (
              <form action={archiveCase} className="w-full">
                <input type="hidden" name="case_id" value={caseId} />
                <button
                  type="submit"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-4 py-2 text-left text-sm text-[#25272a] transition-colors hover:bg-[#f1f1ef]"
                >
                  Archivar
                </button>
              </form>
            )}

            {canArchive && isArchived && (
              <form action={unarchiveCase} className="w-full">
                <input type="hidden" name="case_id" value={caseId} />
                <button
                  type="submit"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-4 py-2 text-left text-sm text-[#25272a] transition-colors hover:bg-[#f1f1ef]"
                >
                  Desarchivar
                </button>
              </form>
            )}

            {canDelete && (
              <form action={deleteCase} className="w-full" onSubmit={(e) => {
                if (!window.confirm(`Vas a borrar este ${terms.expedienteSingular.toLowerCase()} y todo su contenido interno (checklist, cronología, análisis de IA y agenda). Los documentos quedan guardados en la Bóveda. Esta acción no se puede deshacer. ¿Continuar?`)) {
                  e.preventDefault();
                }
              }}>
                <input type="hidden" name="case_id" value={caseId} />
                <button
                  type="submit"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-4 py-2 text-left text-sm font-semibold text-[#a63d33] transition-colors hover:bg-[#fbf1f0]"
                >
                  Eliminar
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
