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

## Lote 4 — Secciones plegables en ficha de expediente (PR #40, merged)

- Componente `CollapseArea` (patrón "Consultar al agente"): header con label + resumen (chips/counts) + caret; el cuerpo queda montado para no perder borradores ni estados.
- Aplicado a: Cotejo (3 rubros), Pre-Score, Borrador de reserva/boleto, Borrador de escritura, Análisis UIF, Liquidación, Vencimiento procesal, Tasa de justicia, Aviso comercial.
- Documentación del sistema: `docs/DESIGN-SYSTEM.md` (tokens, reglas, componentes) + este registro.

## Lote 5 — Sub-lote oscuro + pulido Modelos (PR #41, merged 22/11)

- Variante `dark` de SelectField (tema oscuro en SharedControls: trigger `#181c1f`, popup `#1c2124`, focus del sistema) para las superficies oscuras: Calculadoras (3 selects), Protocolo (3), Tasación (1).
- Alquileres/Índices resultó tema CLARO: sus 3 selects van al SelectField estándar (sin variante oscuro).
- S5-G3: paleta slate de Modelos convergiendo a grises del sistema (`#25272a` texto, `#62676d` secundario, `#8a8f94` terciario, `#d9d9d6`/`#e0e1e1` bordes, focus `#415a71`) en `RevisarEscrito` y `ModelosClient`. El título lavado del panel de revisión IA era la regla legacy `[class*="text-slate"]` — resuelto de raíz.
- Fixes de preview: panel sin espacio blanco (`034f947`), summary con sangría (`910b51b`), título siempre visible con color inline (`1acd6e4`). Verificado por usuario (título legible, panel compacto, summary sangrado) — merged con 6 checks verdes.
- Tooling versionado (rama `chore/skills-diseno`): emil's skills (emil-design-eng + 7, en `.agents/skills/`), impeccable (critique/audit + detector de slop, `.agents/skills/impeccable` + `.github/`) y design-taste-frontend (uso exclusivo landing; auditoría de scripts pendiente).
- Pendiente para un lote posterior: botones con gradientes violeta/ámbar/cian de las superficies oscuras (Calculadoras/Protocolo) → alineación con jerarquía de botones del sistema.

## Lote 6 — Carteras de propiedades y clientes (PR #43, merged 24/11)

- Rediseño completo de las dos carteras con el usuario: 4 iteraciones (workbench → muestras A/B/C → índice editorial rechazado en preview → "Vitrina sin ruido" aprobada).
- Ficha propiedades: tile con icono por tipo de propiedad, nombre/dirección/pill, specs, precio héroe, CTA grafito primario. Ficha clientes: iniciales grafito + criterio + presupuesto/contacto.
- **Decisión tipográfica (nueva regla en DESIGN-SYSTEM):** dos niveles — mono para datos densos; números héroe en Manrope 600 tabular. Y la decisión "No cargado": un fallback es texto de UI (Manrope 500 `#626b73`), nunca mono ni falso cero.

## Lote 7 — Valor global (PR #44, en curso)

- **Secciones por rubro verificadas en código** (auditoría paquete 7): el filtrado por `industries` + reetiquetado por rubro ya funciona; página /herramientas con eyebrow inconsistente corregido a "Utilidades" en los 3 rubros (hallazgo H1); grupo neutro "Herramientas" para empresa/general (H2). El resto: confirmado correcto (Modelos y Buscar comparten pantalla con contenido por rubro).
- **S5-G2 saldado con evidencia:** las 4 acciones IA de fichas (aviso, matching propiedades, tasación, matching clientes) muestran el resultado inline — el resultado es el feedback de éxito; sin refresh.
- **Fixes anti-slop en fichas de propiedades:** emojis reemplazados por iconos Phosphor (WhatsApp, Regenerar, Copiar, Warning) y panel de resultado de matching sin gradiente ni glow (superficie consistente con las demás).
- **Decisión "No cargado" implementada** en ficha de detalle de propiedad (fallback ya no en mono 22px).
- Pendiente en este lote: control de funcionamiento completo por rubro (escribanía → jurídico) y verificación en preview.
## Lote 8 — Nodo logístico escribanía (PR #47, en curso)

- **A1 · Vigencias pre-firma:** el checklist muestra el estado del vencimiento del documento vinculado (chip Vigente/por vencer/VENCIDO con tintes semánticos, contadores en el pie) y permite registrar/ajustar la fecha de vencimiento desde "Gestionar requisito" (`setDocumentoVencimiento` → `documents.expires_at`, que Agenda/Dashboard ya consumen). Sin migración: se reutiliza la infraestructura de vencimientos existente.
- **A2 · Plazos post-firma:** al otorgar el legajo (escribanía), el sistema ofrece (no ejecuta) agendar Sellado e Inscripción en la Agenda, con fechas editables y aviso "no es un plazo legal calculado" (`?postfirma=1` → `PostFirmaPanel` → `guardarPlazoDetectado`).
- **A3 · Nota de pendientes al cliente:** borrador de texto armado desde el checklist y los vencimientos (`buildNotaPendientes`), editable y copiable; la plataforma no envía nada (`NotaPendientesPanel` en la pestaña Checklist).
- **B1 · Comparador de instrumentos (escribanía):** cotejo IA de dos documentos del legajo (minuta vs. protocolizada), reporte con diferencias/coincidencias/advertencias guardado en `ai_outputs` (`output_type=document_comparison`), con hint de espera y lectura guardada.
- H17 (revisión IA de instrumentos para escribanía) saldado en PR #46.

## Ruta pendiente (orden agilizado)

1. ~~Sub-lote oscuro~~ (PR #41) → ~~Lote valor global~~ (PR #44) → ~~Lote módulos oscuros~~ (PR #45) → ~~H17~~ (PR #46) → **Lote nodo logístico escribanía** (en curso, PR #47).
2. **Lotes por rubro:** jurídico (patrones Argus/Nino: portales judiciales, cálculos — los cálculos ya existen en versión propia) → inmobiliario (habilitar revisión IA de documentos + mejoras propias).
3. **Ciberseguridad P0 + certificación básica** antes de datos reales de terceros (con documento propio del usuario).
4. **Lanzamiento**: onboarding, tutoriales. Landing con taste-skill (previa auditoría de scripts).
5. Backlog no bloqueante: Vercel X (29/11), estrategia fundraising (conversación aparte), liquidación de gastos por legajo / registro de certificaciones / autoevaluación UIF anual / vigencia de mandatos (backlog escribanía).

## Lecciones de proceso (resumen)

- La misma acción puede vivir en 2 componentes → grep del texto del botón en todo el repo antes de asumir que el fix alcanzó todo.
- Columnas fijas + texto largo → desborde por min-content; la solución es `min-w-0` en el componente, no estilos periféricos.
- Cada entrada de CHANGELOG se commitea en la rama siguiente y se rebaza antes del push final (evita conflictos add/add).
- `PropertyWorkspace.test.ts` es flaky en CI de vez en cuando (re-run); `shellV3.test.ts` falla solo en Windows local por CRLF (CI pasa).
- Chrome marca "Peligroso" los subdominios vercel.app: falso positivo de terceros, solo previews.
