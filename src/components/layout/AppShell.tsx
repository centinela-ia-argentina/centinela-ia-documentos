import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import styles from './Shell.module.css';

interface AppShellProps { children: React.ReactNode; }

export function AppShell({ children }: AppShellProps) {
  return <ShellFrame sidebar={<Sidebar />} topbar={<Topbar />}>{children}</ShellFrame>;
}

/** Same frame for production and isolated visual QA; no alternate application route. */
export function ShellFrame({ children, sidebar, topbar }: AppShellProps & {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
}) {
  return (
    <div className={`internal-shell ${styles.shell}`} data-visual-system="v3">
      <a className={styles.skip} href="#contenido-principal">Saltar al contenido</a>
      {sidebar}
      <div className={styles.workspace}>
        {topbar}
        <main id="contenido-principal" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
