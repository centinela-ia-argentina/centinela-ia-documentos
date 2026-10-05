import type { Icon } from '@phosphor-icons/react';
import {
  BookOpenText,
  Buildings,
  Calculator,
  CalendarDots,
  ChartBar,
  FileText,
  FolderOpen,
  GearSix,
  House,
  Key,
  MagnifyingGlass,
  Robot,
  Scan,
  Sparkle,
  SquaresFour,
  Tray,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react/ssr';
import { type IndustryType } from '@/lib/industries/documentTypes';

export type NavItem = {
  name: string;
  href: string;
  icon: Icon;
  roles: string[];
  industries?: IndustryType[];
  group: string;
  description?: string;
};

export const navigation: NavItem[] = [
  { name: 'Inicio', href: '/dashboard', icon: House, roles: ['admin', 'employee', 'auditor'], group: 'Operación', description: 'Panel principal y acceso rápido a módulos.' },
  { name: 'Agente IA general', href: '/agente', icon: Robot, roles: ['admin', 'employee'], group: 'Operación', description: 'Guía de navegación, módulos y flujos de la plataforma.' },
  { name: 'Expedientes', href: '/expedientes', icon: FolderOpen, roles: ['admin', 'employee', 'auditor'], group: 'Operación', description: 'Gestión operativa de expedientes vinculados.' },
  { name: 'Propiedades', href: '/propiedades', icon: Buildings, roles: ['admin', 'employee', 'auditor'], industries: ['inmobiliaria'], group: 'Operación', description: 'Gestión y catálogo de propiedades.' },
  { name: 'Clientes', href: '/clientes', icon: UsersThree, roles: ['admin', 'employee', 'auditor'], industries: ['inmobiliaria'], group: 'Operación', description: 'Gestión de clientes y búsqueda inmobiliaria.' },
  { name: 'Alquileres', href: '/alquileres', icon: Key, roles: ['admin', 'employee', 'auditor'], industries: ['inmobiliaria'], group: 'Operación', description: 'Registro y seguimiento de contratos de alquiler.' },
  { name: 'Panel inmobiliario', href: '/copiloto', icon: SquaresFour, roles: ['admin', 'employee', 'auditor'], industries: ['inmobiliaria'], group: 'Operación', description: 'Briefing, propiedades, clientes y alquileres.' },
  { name: 'Documentos', href: '/documentos', icon: FileText, roles: ['admin', 'employee', 'auditor'], group: 'Operación', description: 'Bóveda documental y análisis en modo beta.' },
  { name: 'Recibidos', href: '/recibidos', icon: Tray, roles: ['admin', 'employee', 'auditor'], industries: ['escribania'], group: 'Operación', description: 'Legajos que otras organizaciones derivaron a tu estudio.' },
  { name: 'Buscar', href: '/buscar', icon: MagnifyingGlass, roles: ['admin', 'employee'], group: 'Utilidades', description: 'Búsqueda avanzada de expedientes y documentos.' },
  { name: 'Observaciones', href: '/observaciones', icon: WarningCircle, roles: ['admin', 'employee', 'auditor'], group: 'Gestión', description: 'Panel de observaciones y tareas pendientes.' },
  { name: 'Calculadoras', href: '/calculadoras', icon: Calculator, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania'], group: 'Herramientas jurídicas', description: 'Herramientas de cálculo para plazos y montos.' },
  { name: 'Modelos', href: '/modelos', icon: FileText, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania', 'inmobiliaria'], group: 'Herramientas jurídicas', description: 'Plantillas y modelos de documentos.' },
  { name: 'Índice / Repertorio', href: '/protocolo', icon: BookOpenText, roles: ['admin', 'employee', 'auditor', 'client'], industries: ['escribania'], group: 'Herramientas jurídicas', description: 'Registro correlativo de escrituras y actos, con índice por mes.' },
  { name: 'Agenda', href: '/agenda', icon: CalendarDots, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania', 'inmobiliaria'], group: 'Herramientas jurídicas', description: 'Calendario de vencimientos y plazos.' },
  { name: 'Herramientas', href: '/herramientas', icon: Scan, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania', 'inmobiliaria'], group: 'Utilidades', description: 'Utilidades extra para gestión documental.' },
  { name: 'Usuarios', href: '/usuarios', icon: UsersThree, roles: ['admin'], group: 'Gestión', description: 'Administración de usuarios e invitaciones.' },
  { name: 'Reportes', href: '/reportes', icon: ChartBar, roles: ['admin', 'employee', 'auditor'], group: 'Gestión', description: 'Métricas y reportes de actividad.' },
  { name: 'Ajustes', href: '/configuracion', icon: GearSix, roles: ['admin'], group: 'Gestión', description: 'Ajustes globales y preferencias de la plataforma.' },
];
