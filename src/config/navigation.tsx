import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileText,
  FolderKanban,
  Users,
  AlertCircle,
  Calculator,
  FileSignature,
  CalendarDays,
  ScanLine,
  Search,
  Settings,
  BookText,
  Building2,
  KeyRound,
  Sparkles,
  Inbox,
  Bot,
} from 'lucide-react';
import { type IndustryType } from '@/lib/industries/documentTypes';

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
  industries?: IndustryType[];
  group: string;
  description?: string;
};

export const navigation: NavItem[] = [
  { name: 'Inicio', href: '/dashboard', icon: BarChart3, roles: ['admin', 'employee', 'auditor', 'client'], group: 'Operación', description: 'Panel principal y acceso rápido a módulos.' },
  { name: 'Agente IA general', href: '/agente', icon: Bot, roles: ['admin', 'employee'], group: 'Operación', description: 'Consultas generales sobre tu organización, casos, plazos y alertas.' },
  { name: 'Expedientes', href: '/expedientes', icon: FolderKanban, roles: ['admin', 'employee', 'auditor', 'client'], group: 'Operación', description: 'Gestión operativa de expedientes vinculados.' },
  { name: 'Propiedades', href: '/propiedades', icon: Building2, roles: ['admin', 'employee', 'auditor', 'client'], industries: ['inmobiliaria'], group: 'Operación', description: 'Gestión y catálogo de propiedades.' },
  { name: 'Clientes', href: '/clientes', icon: Users, roles: ['admin', 'employee', 'auditor', 'client'], industries: ['inmobiliaria'], group: 'Operación', description: 'Gestión de clientes y búsqueda inmobiliaria.' },
  { name: 'Alquileres', href: '/alquileres', icon: KeyRound, roles: ['admin', 'employee', 'auditor', 'client'], industries: ['inmobiliaria'], group: 'Operación', description: 'Registro y seguimiento de contratos de alquiler.' },
  { name: 'Panel inmobiliario', href: '/copiloto', icon: Sparkles, roles: ['admin', 'employee', 'auditor', 'client'], industries: ['inmobiliaria'], group: 'Operación', description: 'Briefing, propiedades, clientes y alquileres.' },
  { name: 'Documentos', href: '/documentos', icon: FileText, roles: ['admin', 'employee', 'auditor', 'client'], group: 'Operación', description: 'Bóveda documental y análisis en modo beta.' },
  { name: 'Recibidos', href: '/recibidos', icon: Inbox, roles: ['admin', 'employee', 'auditor'], industries: ['escribania'], group: 'Operación', description: 'Legajos que otras organizaciones derivaron a tu estudio.' },
  { name: 'Buscar', href: '/buscar', icon: Search, roles: ['admin', 'employee'], group: 'Utilidades', description: 'Búsqueda avanzada de expedientes y documentos.' },
  { name: 'Observaciones', href: '/observaciones', icon: AlertCircle, roles: ['admin', 'employee', 'auditor', 'client'], group: 'Gestión', description: 'Panel de observaciones y tareas pendientes.' },
  { name: 'Calculadoras', href: '/calculadoras', icon: Calculator, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania'], group: 'Herramientas jurídicas', description: 'Herramientas de cálculo para plazos y montos.' },
  { name: 'Modelos', href: '/modelos', icon: FileSignature, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania', 'inmobiliaria'], group: 'Herramientas jurídicas', description: 'Plantillas y modelos de documentos.' },
  { name: 'Índice / Repertorio', href: '/protocolo', icon: BookText, roles: ['admin', 'employee', 'auditor', 'client'], industries: ['escribania'], group: 'Herramientas jurídicas', description: 'Registro correlativo de escrituras y actos, con índice por mes.' },
  { name: 'Agenda', href: '/agenda', icon: CalendarDays, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania'], group: 'Herramientas jurídicas', description: 'Calendario de vencimientos y plazos.' },
  { name: 'Herramientas', href: '/herramientas', icon: ScanLine, roles: ['admin', 'employee', 'auditor'], industries: ['legal', 'escribania'], group: 'Utilidades', description: 'Utilidades extra para gestión documental.' },
  { name: 'Usuarios', href: '/usuarios', icon: Users, roles: ['admin'], group: 'Gestión', description: 'Administración de usuarios e invitaciones.' },
  { name: 'Reportes', href: '/reportes', icon: BarChart3, roles: ['admin', 'employee', 'auditor'], group: 'Gestión', description: 'Métricas y reportes de actividad.' },
  { name: 'Ajustes', href: '/configuracion', icon: Settings, roles: ['admin'], group: 'Gestión', description: 'Ajustes globales y preferencias de la plataforma.' },
];
