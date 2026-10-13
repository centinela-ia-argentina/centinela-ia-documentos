'use client';

import { useRef, useState, type ReactNode } from 'react';
import { FileText, Megaphone, ChartScatter, UsersThree, PencilSimple } from '@phosphor-icons/react';
import { ArrowRight } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import type { PropertyRecord } from '@/types/property';
import { PropertyEditForm } from './PropertyEditForm';
import styles from './PropertyDetail.module.css';

const tabs = [
  { key: 'ficha', label: 'Ficha', icon: FileText },
  { key: 'comercial', label: 'Comercial', icon: Megaphone },
  { key: 'tasacion', label: 'Tasación y comparables', icon: ChartScatter },
  { key: 'vinculos', label: 'Vínculos', icon: UsersThree },
] as const;
type Area = (typeof tabs)[number]['key'];
interface Props {
  record: PropertyRecord; canManage: boolean; useAi: boolean;
  documents: { id: string; file_name: string }[];
  header: ReactNode; ficha: ReactNode; comercial: ReactNode; tasacion: ReactNode; vinculos: ReactNode;
}
export function PropertyWorkspace(props: Props) {
  const [active, setActive] = useState<Area>('ficha');
  const [editing, setEditing] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const editRef = useRef<HTMLDivElement>(null);
  function focusTab(index: number) {
    setActive(tabs[index].key);
    tabRefs.current[index]?.focus();
  }
  return <div className={styles.page}>
    <header className={styles.header}>
      {props.header}
      {props.canManage && !editing && <div ref={editRef} className={styles.editAction}><AppButton onClick={() => { setEditing(true); }} className={styles.primary}>
        <PencilSimple size={18} weight="duotone" aria-hidden="true" /> Editar propiedad <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />
      </AppButton></div>}
    </header>
    <div hidden={editing}>
      <nav className={styles.tabs} role="tablist" aria-label="Áreas de la propiedad">
        {tabs.map(({ key, label, icon: Icon }, index) => <button key={key} ref={el => { tabRefs.current[index] = el; }} id={`property-tab-${key}`} role="tab" aria-selected={active === key} aria-controls={`property-panel-${key}`} tabIndex={active === key ? 0 : -1} onClick={() => setActive(key)} onKeyDown={e => {
          let next: number;
          switch (e.key) { case 'ArrowRight': next = (index + 1) % tabs.length; break; case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break; case 'Home': next = 0; break; case 'End': next = tabs.length - 1; break; default: return; }
          e.preventDefault(); focusTab(next);
        }}><Icon size={20} weight="duotone" aria-hidden="true" />{label}</button>)}
      </nav>
      {/* Keep all real tools mounted: switching areas must not erase publication/message/AI drafts. */}
      {tabs.map(({ key }) => <section key={key} id={`property-panel-${key}`} role="tabpanel" aria-labelledby={`property-tab-${key}`} tabIndex={0} hidden={active !== key}>{props[key]}</section>)}
    </div>
    {editing && <div><PropertyEditForm record={props.record} documents={props.documents} useAi={props.useAi} onCancel={() => {
      setEditing(false);
      requestAnimationFrame(() => editRef.current?.querySelector('button')?.focus());
    }} /></div>}
  </div>;
}
