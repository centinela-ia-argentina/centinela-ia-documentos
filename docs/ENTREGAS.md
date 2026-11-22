# Entregas — registro consolidado

Resumen de lo entregado con la asistencia de IA (DeepAI Code), en qué consistió cada
lote y qué queda por delante. El detalle commit por commit y las lecciones de cada PR
viven en `CHANGELOG.md`; el código está en el historial de PRs de GitHub.

## Lote 1 — Reconstrucción del shell V3 (PRs #26–#28)

- Shell interno v3: sidebar de navegación por grupos (operación, herramientas, gestión), header, perfil de organización.
- Layout responsive (breakpoints 1250/900/680px) y base de navegación para los módulos.

## Lote 2 — Estandarización UI/UX S1–S5 (PRs #29–#38)

Metodología: auditoría por paquetes de capturas → registro con severidad → verificación contra código → paquete de solución aprobado por el usuario → implementación por fases.

| PR | Contenido |
|---|---|
| #29, #30, #32 | S3: migración de módulos al sistema (Dashboard, Operaciones, Agenda, Cronología, landing de subida, clientes, propiedades, modelos, reportes, observaciones); selects nativos → SelectField en componentes compartidos; restos (rol pendiente, elipsis en aside) |
| #31 | S1 Gobernanza (SYNC.md, CHANGELOG, tokens en globals.css, /ui-kit solo admin) + S2 Tipografía (Space Grotesk solo landing, JetBrains Mono en datos) |
| #33 | S4-A: convergencia de grises a `#25272a` (149 ocurrencias, 24+ archivos) |
| #34 | S4-B: focus único `#415a71` (15 ocurrencias de `#3d526c` eliminadas) |
| #35, #36, #37 | S4-C: JetBrains Mono en fichas de detalle (propiedades, clientes, expedientes), agenda y métricas grandes |
| #38 | S5: auditoría de los 5 estados + hint de progreso + spinner en las 3 acciones IA largas |

## Lote 3 — SelectField en formularios (PR #39)

- 22 selects nativos migrados a SelectField en 16 archivos: fichas de clientes (ClientRecordForm), alquileres (RentalContractForm), expedientes (CaseFacts, LinkedProperty), CalificarInquilino, configuración, onboarding, herramientas de texto/imagenes, asistente de propiedad.
- Fixes de verificación con el usuario: popup compacto en todo contexto, `min-w-0` para columnas angostas (causa raíz del desborde en la columna de datos), botones en una línea, errores de IA humanizados (`error_descarga` → mensaje en español).
- Adaptación de tests unitarios (patrón trigger/option/hidden input) y e2e.

## Lote 4 — Secciones plegables en ficha de expediente (PR #40, en curso)

- Componente `CollapseArea` (patrón "Consultar al agente"): header con label + resumen (chips/counts) + caret; el cuerpo queda montado para no perder borradores ni estados.
- Aplicado a: Cotejo (3 rubros), Pre-Score, Borrador de reserva/boleto, Borrador de escritura, Análisis UIF, Liquidación, Vencimiento procesal, Tasa de justicia, Aviso comercial.
- Documentación del sistema: `docs/DESIGN-SYSTEM.md` (tokens, reglas, componentes) + este registro.

## Ruta pendiente (orden agilizado)

1. **Sub-lote oscuro**: SelectField + alineación visual de módulos oscuros (calculadoras, protocolo, tasación, índices) + paleta slate de Modelos/Agente (S5-G3).
2. **Secciones por rubro** (jurídico, escribanía): el lote de valor diferencial.
3. **Ciberseguridad P0 + certificación básica** antes de datos reales de terceros.
4. **Lanzamiento**: onboarding, tutoriales.
5. Backlog no bloqueante: Vercel X (29/11), estrategia fundraising (conversación aparte).

## Lecciones de proceso (resumen)

- La misma acción puede vivir en 2 componentes → grep del texto del botón en todo el repo antes de asumir que el fix alcanzó todo.
- Columnas fijas + texto largo → desborde por min-content; la solución es `min-w-0` en el componente, no estilos periféricos.
- Cada entrada de CHANGELOG se commitea en la rama siguiente y se rebaza antes del push final (evita conflictos add/add).
- `PropertyWorkspace.test.ts` es flaky en CI de vez en cuando (re-run); `shellV3.test.ts` falla solo en Windows local por CRLF (CI pasa).
- Chrome marca "Peligroso" los subdominios vercel.app: falso positivo de terceros, solo previews.
