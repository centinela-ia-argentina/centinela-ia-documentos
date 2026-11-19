import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { SelectField } from '@/components/ui/SelectField';
import styles from './uiKit.module.css';

export const metadata = { title: 'Kit de interfaz' };

const typeScale: Array<{ label: string; sample: React.ReactNode }> = [
  { label: 'H1 · 34/1.2 · 600 · -1.1', sample: <h1 className={styles.spH1}>Revisión de garantías</h1> },
  { label: 'H2 · 22/1.35 · 600 · -0.5', sample: <h2 className={styles.spH2}>Documentos del expediente</h2> },
  { label: 'H3 · 15/1.5 · 600', sample: <h3 className={styles.spH3}>Boleto de compraventa</h3> },
  { label: 'Body · 13/1.8', sample: <p className={styles.spBody}>El análisis IA es una acción separada y no reemplaza la revisión profesional del documento.</p> },
  { label: 'Small · 11/1.7', sample: <p className={styles.spSmall}>Última revisión: hace 3 días · Origen: Manual</p> },
  { label: 'Caption · 9 · caps · ls 1px', sample: <p className={styles.spCaption}>Bóveda · Carga de archivos</p> },
  { label: 'Mono · datos · tabular-nums', sample: <p className={styles.spMono}>EXP-2026-0041 · $1.482.500,00 · 27/08/2026 · 96,4%</p> },
];

export default async function UiKitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { profile } = await getUserProfile();
  if (!profile) redirect('/onboarding');
  if (profile.role !== 'admin') redirect('/acceso-denegado');

  return (
    <AppShell>
      <div className={styles.uiKit}>
        <p className={styles.spCaption}>Interno · Solo administradores</p>
        <h1>Kit de interfaz</h1>
        <p className={styles.intro}>
          Todos los primitivos en una sola pantalla para verificar que la plataforma se ve como una sola marca.
          Este catálogo resume el estándar completo, que vive en <strong>SYNC.md</strong> (raíz del repo).
          Si algo de la app no se parece a esta página, es una deuda a corregir, no una variante válida.
        </p>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Tipografía</h2>
            <p>Manrope en toda la app · mono solo para datos</p>
          </div>
          <dl className={styles.specimen}>
            {typeScale.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                {item.sample}
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Botones</h2>
            <p>Jerarquía: 1 principal por vista</p>
          </div>
          <div className={styles.row}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>Guardar cambios</button>
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`}>Ver documentos</button>
            <button type="button" className={`${styles.btn} ${styles.btnSuccess}`}>Analizar documento</button>
            <button type="button" className={`${styles.btn} ${styles.btnDanger}`}>Quitar requisito</button>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`}>Cancelar</button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.sm}`}>Compacto</button>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Campos</h2>
            <p>Label arriba · help text debajo de los campos complejos</p>
          </div>
          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="uikit-demo-text">Nombre de la operación</label>
              <input id="uikit-demo-text" type="text" placeholder="Ej: Alquiler Av. Siemprevida 742" readOnly />
              <small>Se usa para identificar la operación en listados y reportes.</small>
            </div>
            <div className={styles.field}>
              <SelectField
                name="uikit_demo_select"
                label="Tipo documental"
                defaultValue=""
                placeholder="Sin clasificar"
                options={[
                  { value: '', label: 'Sin clasificar' },
                  { value: 'boleto', label: 'Boleto de compraventa' },
                  { value: 'contrato', label: 'Contrato de alquiler' },
                  { value: 'escritura', label: 'Escritura' },
                ]}
              />
              <small>El trigger muestra el valor; el menú abre hacia donde haya lugar.</small>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Pills, estados y datos</h2>
            <p>El punto de color indica estado; el fondo no cambia</p>
          </div>
          <div className={styles.row}>
            <span className={styles.pill}>Pendiente</span>
            <span className={`${styles.pill} ${styles.pillOk}`}>Recibido</span>
            <span className={`${styles.pill} ${styles.pillWarn}`}>En revisión</span>
            <span className={`${styles.pill} ${styles.pillLate}`}>Vencido</span>
            <span className={styles.tag}>Con análisis</span>
            <span className={styles.tag}>Alta</span>
          </div>
          <dl className={styles.grid2} style={{ marginTop: 20 }}>
            <div className={styles.dataRow}>
              <dt>Número de operación</dt>
              <dd>OP-2026-0117</dd>
            </div>
            <div className={styles.dataRow}>
              <dt>Monto</dt>
              <dd>$1.482.500,00</dd>
            </div>
            <div className={styles.dataRow}>
              <dt>Vencimiento</dt>
              <dd>27/08/2026</dd>
            </div>
            <div className={styles.dataRow}>
              <dt>Tamaño de archivo</dt>
              <dd>59 KB</dd>
            </div>
          </dl>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Card</h2>
            <p>Borde 1px · radio 7px · sombra mínima</p>
          </div>
          <div className={styles.card} style={{ maxWidth: 420 }}>
            <h3>Análisis documental beta</h3>
            <p>El análisis IA extrae datos del documento y los propone para revisión. No se ejecutan ni se persisten sin tu confirmación.</p>
            <div className={styles.cardFoot}>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.sm}`}>Ver detalles</button>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.sm}`}>Analizar documento</button>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Los 5 estados</h2>
            <p>Obligatorios en toda acción asincrónica</p>
          </div>
          <div className={styles.stateNote}>
            <strong>Referencia rápida</strong>
            <ul>
              <li><strong>Vacío:</strong> explica qué va a pasar acá y qué hacer primero.</li>
              <li><strong>Carga:</strong> skeleton o spinner discreto, sin saltos de layout.</li>
              <li><strong>Progreso:</strong> indica que la IA trabaja sin prometer resultado.</li>
              <li><strong>Error:</strong> qué pasó + reintentar, conservando lo escrito.</li>
              <li><strong>Éxito:</strong> confirmación discreta, sin celebraciones.</li>
            </ul>
          </div>
        </section>

        <p className={styles.uiFoot}>
          Fuente de verdad: SYNC.md · Historial: CHANGELOG.md · Cualquier desvío del código respecto de esta página se corrige o se registra como deuda en SYNC.md.
        </p>
      </div>
    </AppShell>
  );
}
