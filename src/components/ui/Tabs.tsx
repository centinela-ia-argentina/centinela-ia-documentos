'use client';
import { useState, useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './SharedControls.module.css';

type Tab = { id: string; label: ReactNode; content: ReactNode };

export function Tabs({ tabs, initial }: { tabs: Tab[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  // Al montar: si la URL trae ?tab=... y es válido, respetamos esa pestaña.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de pestaña: guardamos la sección en la URL (sin recargar la página).
  const handleSelect = (id: string) => {
    setActive(id);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState(null, '', url.toString());
  };
  return (
    <div>
      <div className={styles.tabList} role="tablist" aria-label="Secciones de la ficha">
        {tabs.map((t, index) => (
          <button
            key={t.id}
            ref={(element) => { buttons.current[index] = element; }}
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel-${index}`}
            aria-selected={active === t.id}
            tabIndex={active === t.id ? 0 : -1}
            type="button"
            onClick={() => handleSelect(t.id)}
            onKeyDown={(event) => {
              let next: number;
              switch (event.key) {
                case 'ArrowRight': next = (index + 1) % tabs.length; break;
                case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
                case 'Home': next = 0; break;
                case 'End': next = tabs.length - 1; break;
                default: return;
              }
              event.preventDefault();
              handleSelect(tabs[next].id);
              buttons.current[next]?.focus();
            }}
            className={styles.tab}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, index) => (
        <div key={t.id} role="tabpanel" id={`${id}-panel-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
