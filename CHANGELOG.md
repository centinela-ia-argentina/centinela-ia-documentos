# CHANGELOG — Anulus AI Documentos

Historial cronológico del proyecto. Cada entrada se agrega al cerrar un PR (hito).
Formato por fecha; los PR quedan enlazados con su detalle completo (commits, checks, deploys) en GitHub.

---

## 2026-11-18 — S3 Tanda 2: migración de selects + rediseño de Subir (PR #30 — merged `e38011c`)

- **Últimos selects nativos de componentes compartidos → SelectField**: Expedientes→Nuevo (tipo, estado, metadata), Cronología (tipo de evento + filtro Origen), Checklist de documentos (vinculación), Modelos (prellenado desde expediente). Wizard de operaciones ya estaba migrado.
- E2E de los 3 rubros adaptados al patrón trigger + opción (juridico 10.5/14b/case-type/modelos, escribania, inmobiliaria checklist, transversal con test de manipulación de case_type).
- **Rediseño de /documentos/subir**: aside "Antes de subir" (notas estáticas) reemplazado por "Subidos recientemente" con los últimos 5 documentos reales de la org, meta `destino · fecha · tipo`, link a cada ficha, "Ver todos los documentos" y micro-notas al pie. Layout grilla movido a la página server-side; aside alineado con el h1.
- **Next.js 16.4.6** (advisory GHSA-mfr8-8qww-v76h) + lockfile actualizado.
- **CI**: gate de `npm audit` cambiado a dependencias de producción (`--omit=dev`); los 22 advisories "high" restantes son solo dev-tooling (vite beta, vitest, eslint, tailwind) y quedan en backlog.
- Fix: `overscroll-behavior: contain` en el modal de Agenda (no propaga scroll al fondo).
- CI final: #251 SUCCESS (Unit 1455/1455, Security 158, E2E 210, Migration). Aprobado por el usuario en Preview de Vercel (desktop, responsive 800px y subida real).

## 2026-11-15 — Reconstrucción + S3 Tanda 1 (PR #28 + PR #29 — merged a main)

- **Reconstrucción de la segunda ronda UI/UX** (PR #28): base de estandarización del shell, componentes compartidos y layouts de módulos.
- **S3 Tanda 1** (PR #29): 15 fixes de la auditoría UI/UX — select→SelectField en formularios clave, textos ("Sin clasificar", chip de Usuarios, textos de Observaciones), pills de observaciones con días reales (`formatTimestampDate`), Modelos (separador etiqueta/valor, botón violeta→grafito, emoji fuera), Agenda (modal para el evento manual, celda desbordada, "Hora (opcional)"), visor ("Documento sin nombre"), link duplicado de Clientes, saludo del panel, barras de reportes, default de /buscar = Buscador operativo con RAG como segunda opción.
- SQL de soporte aplicado en Supabase de producción ANTES del merge (merge = deploy automático).

## 2026-10 (aprox.) — fix(ui): pantalla completa y cabecera sin superposición (PR #27)

- Corrección de superposición entre cabecera del shell y contenido.

## Anteriores (fase de reconstrucción)

- Migración de base de datos, reconstrucción del núcleo (auth, organizaciones, expedientes, documentos, checklist, auditoría), Fase 0 de verticalización (`industry_type` + diccionario documental por rubro) y validación de los 3 rubros (legal, inmobiliaria, escribanía).
- Metodología UI/UX permanente: auditoría visual en 6 paquetes (91 capturas), verificación de cada hallazgo contra el código, y paquete de solución S1–S5 + Lote 2 (ver `SYNC.md` para el estándar vigente).

---

## Próximos lotes (roadmap)

- **S1 Gobernanza**: este lote — SYNC.md, CHANGELOG.md, tokens tipográficos/mono, /ui-kit.
- **S2 Tipografía**: quitar Space Grotesk del interior de la app (solo landing) + JetBrains Mono para datos.
- **S3 restos menores**: chip "i" azul en Usuarios, rol "Sin definir" en invitaciones, truncado de nombres largos en "Subidos recientemente".
- **S4**: catálogo de primitivos en `src/components/ui` + migración de islas de estilo por fases.
- **S5**: auditoría de los 5 estados (vacío/carga/progreso/error/éxito) en secciones críticas.
- **Lote 2 de selects**: calculadoras (~49), protocolo (~34), recibidos (~35), tasación (~47), módulos (~8), ClientRecordForm, CalificarInquilino.
- **Secciones personalizadas por rubro** (jurídico, escribanía) en lotes propios.
- **Ciberseguridad P0 + certificación básica** antes de manejar documentos reales de terceros.
- **Lanzamiento**: tutoriales, instrucciones, onboarding de organizaciones.
