# AGENTS.md — Centinela IA Documentos

> Brief de contexto para agentes de código. Leé este archivo antes de tocar nada.
> Si el código contradice este documento, el código manda; avisá la discrepancia.

## 1. Qué es
SaaS web multi-organización de gestión documental inteligente para rubros con documentación sensible (jurídico, escribanía, inmobiliaria, empresa). Centraliza expedientes + PDFs, control de acceso por rol, auditoría de acciones y análisis documental beta en entorno controlado (sin IA externa paga todavía). Etapa: beta operativa comercial, producto online.

## 2. Stack
- Next.js 16.3.1 (App Router), TypeScript, Tailwind CSS
- Supabase (Auth + PostgreSQL + Storage), bucket privado "documents" (50MB, visor por enlaces temporales)
- Vercel (deploy auto desde main), GitHub
- Repo: https://github.com/centinela-ia-argentina/centinela-ia-documentos
- Deploy: https://centinela-ia-documentos.vercel.app/

## 3. Arquitectura: núcleo común + configuración por rubro (CLAVE)
NO se hace una app por rubro. Una sola base; lo que cambia por rubro se resuelve por configuración según organizations.industry_type. Llenar los arrays de config verticaliza automáticamente la UI (tipos, estados, campos, checklists, tipos documentales, tarjetas). Los componentes leen funciones de config; no hardcodear listas en las páginas.
Archivos de config:
- src/lib/industries/documentTypes.ts (IndustryType, ACTIVE_INDUSTRY_TYPES = ['general','legal','escribania','inmobiliaria','empresa'], industryLabels, documentTypesByIndustry, getDocumentTypes, getDocumentTypeLabel, isIndustryType, normalizeIndustryType)
- src/lib/industries/caseConfig.ts (CaseFieldDef, caseFieldsByIndustry, caseTypesByIndustry, caseStatusesByIndustry, dashboardCardsByIndustry, getCaseStatusLabel(status, industry))
- src/lib/industries/caseTemplates.ts (caseTemplatesByType: checklists por nombre de tipo de expediente)
Regla de estados: la constraint cases_status_check solo permite 5 valores en inglés: 'new','active','in_review','waiting_client','archived'. Los estados por rubro son SOLO etiquetas (relabel) vía getCaseStatusLabel. Nunca guardar estado en español en la DB. Patrón general: valores en inglés en la base, etiquetas en español en la UI.

## 4. Datos (Supabase)
Tablas: organizations (tiene industry_type), profiles (id, role, organization_id, status, full_name, email), platform_admins (user_id, active), cases, documents, checklists, checklist_items, checklist_templates, ai_outputs, audit_logs, reports, user_invitations, invitation_operational_*.
- cases: id, organization_id, title, client_name, case_type, status, metadata (jsonb), assigned_to, created_by
- checklist_items: status en {pending, received, reviewed}; document_id FK a documents ON DELETE SET NULL

## 5. Roles
Usuario: Administrador (admin), Operador (employee), Auditor (auditor), Cliente (client). platform_owner / tabla platform_admins: solo server-side. Cambiar rubro de una organización es "set once + lock": el admin lo define una vez mientras está en general; luego queda bloqueado y solo platform_owner puede cambiarlo.

## 6. Estado actual
Landing, login, dashboard, expedientes, documentos, análisis beta, reportes, auditoría, usuarios/roles/invitaciones: OK. Seguridad multi-organización validada. Fase 0 (industry_type + diccionario documental) OK. Fase 1 verticalización VALIDADA en 4 rubros: legal, inmobiliaria, escribania, empresa.

## 7. Estado actual de las capacidades jurídicas

- Checklist documental y sugerencias sujetas a revisión profesional.
- Radar de plazos y fechas detectadas por IA.
- Agenda con confirmación humana y mitigación conservadora de duplicados.
- Panel de observaciones para pendientes y documentos que requieren atención.
- Los cálculos, plazos y acciones propuestas no se ejecutan ni persisten sin la intervención correspondiente del usuario.

## 8. Flujo obligatorio de cambios e integración
- Toda modificación comienza desde main actualizado.
- Se crea una rama independiente por paquete.
- Nunca se pushea directamente a main.
- Antes del commit se ejecutan:
  - npm audit --omit=dev
  - npm run lint
  - npm run typecheck
  - npm run test:unit
  - npm run build
  - git diff --check
- Si next-env.d.ts cambia automáticamente sin formar parte del paquete, se restaura antes del commit.
- Se confirma que git status --short contiene únicamente los archivos autorizados.
- Se hace commit y push de la rama independiente.
- Se crea un Draft PR con base main.
- El PR permanece en Draft mientras exista una compuerta pendiente o fallida.
- Deben aprobarse:
  - Lint, Typecheck, Unit Tests & Build
  - Security & RLS Tests
  - Migration & Rollback Tests
  - E2E Playwright Tests
  - Vercel
- Solo con todas las compuertas verdes se pasa de Draft a Ready.
- La integración se realiza mediante squash merge.
- Después del merge se confirma:
  - nuevo SHA de main;
  - ejecución automática del CI por push a main;
  - los cuatro jobs del pipeline en verde;
  - despliegue de Production aprobado por Vercel.
- Si el cambio incluye SQL o migraciones, deben ejecutarse también las verificaciones específicas de migración y rollback.
- Nunca incluir secretos, tokens, contraseñas reales ni credenciales en commits, PR, logs o documentación.

## 9. Lenguaje (UI)
USAR: "beta operativa comercial", "análisis documental beta", "entorno controlado". EVITAR: "IA simulada", "simulado", "beta cerrada", "GitHub privado", "IA mágica". Cuidar acentos al editar config.

## 10. Design tokens (navy premium)
Azul Centinela #0B1E3B; Azul IA #1E9BF0 (hover #1485D6); Cian #29C5FF; Navy #0A1830 / sección #0C2340; subtexto #C2CCD9; éxito #22C55E; advertencia #F59E0B; error #EF4444. Tipografía Inter. Cards radius 14-16px, dark translúcido, borde ~10% blanco. Regla global en src/app/globals.css: select option { background-color:#0C2340; color:#ffffff; } (no quitar).

## 11. Guardrails
Ninguna acción de IA sin auditoría. No modificar datos sensibles sin confirmación humana. No prometer "IA mágica". No duplicar funciones: reorganizar. No quitar funciones actuales salvo duplicadas.
