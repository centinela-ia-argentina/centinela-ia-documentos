# UI V3 — bloque 2: Inicio, Agente y Agenda

## Estado y autorización

Implementación local sobre ae1a5652d4965cb7012fe32886c52ce8ac6a7220, acumulada con el marco del bloque 1. Rama objetivo existente `feat/anulus-shell-inmobiliaria`. Sin commit/push ni despliegue nuevo; falta trasladar las demás pantallas aprobadas y validar el conjunto. No es una nueva muestra ni se solicita otra aprobación estética. No se modifican main ni Production.

Referencias aprobadas (las decisiones posteriores prevalecen sobre encabezados históricos de “propuesta”):
- <mention url="https://app.notion.com/p/044f799d231d451e8acf261821b40610">Inicio V1</mention>.
- <mention url="https://app.notion.com/p/a15c34a032ba4a249784b19f3f4596ce">Agente V1.2</mention>.
- <mention url="https://app.notion.com/p/24762e2da6bf43f49f6961bc55b974c8">Agenda V1</mention>.
- <mention url="https://app.notion.com/p/73df5c966d454c8f8997168ed017f1c3">Flechas unificadas</mention>.

## Traslado

| Antes | Después | Por qué |
| --- | --- | --- |
| Inicio oscuro con marca de agua, contenedor pesado y accesos numerados | Encabezado sobrio, cuatro indicadores, lista compacta de cinco registros y accesos con iconos | Aplicar Inicio V1, priorizar tareas sin inventar series ni actividad reciente. |
| Primeros pasos oscuros con acento decorativo | Lista clara; completado y siguiente paso informativos; enlaces reales | Mantener dos pasos para no administrador y tres para administrador. |
| Agente con gran tarjeta oscura y badges decorativos | Identidad compacta con avatar real, orientación, preguntas y conversación clara | Mantener la jerarquía V1.2, conservar animaciones y estados del avatar existente. |
| Composer con ancho de Enviar no fijado | Alto 44 px, mínimo 112 px escritorio y 44×44 móvil, centrado | Último ajuste V1.2 aprobado; texto visible en escritorio y nombre accesible en móvil. |
| Agenda en paneles oscuros, filtro horizontal | Calendario dominante, prioridades planas y selector Mostrar | Misma vista y opciones en familia V3, sin nueva búsqueda/regla/alerta. |
| Detalle de Agenda como overlay sin contención nativa de foco | Dialog nativo con Escape, foco contenido, retorno y scroll interno | Llevar la interacción accesible de la referencia manteniendo CRUD y confirmación humana. |
| Movimiento vertical en cada cambio de calendario | Fundido breve, sin desplazamiento y reducido según preferencias | Conservar feedback sin movimiento decorativo recurrente. |

Los controles del laboratorio (rubro, escenario, guía, avisos ficticios) no se importaron al producto. Colores decorativos de tipos de evento se sustituyeron por el patrón neutro aprobado; el estado vencido conserva señal semántica. `agendaPresentation.ts` no se cambió: etiquetas y destinos siguen saliendo de sus funciones reales.

## Contratos preservados

- Inicio: autenticación, redirecciones, cinco consultas, derivaciones, orden por creación descendente, cobertura sin alterar su fórmula, cuatro métricas y top cinco. `DashboardView` separa presentación de carga servidor para comprobarla sin base. Formatos de importe/fecha trasladados sin cambiar su lógica. Saludo/fecha siguen usando el reloj local real.
- Onboarding: rutas actuales exactas, estados y distinción admin/no admin; no se corrige silenciosamente la discrepancia `/operaciones/nueva` frente a `/operaciones/nuevo` del vacío.
- Agente: permiso actual, sugerencias por rubro, envío real, historial previo, mensajes, errores, Enter/Shift+Enter, bloqueo mientras espera, scroll, activación y temporizador. No se agrega memoria, servicio o acción IA. Avatar y su código permanecen intactos. Disclaimer usa la misma función de texto; se presenta con estilos locales claros sin recolorear otros consumidores.
- Agenda: consultas y acciones servidor intactas; altas, edición, eliminación, permisos y confirmación humana existentes. Mismos payloads (incluidos los espacios y detalle vacío que ya recibía el handler de alta). No se cambia el contrato pendiente de categoría `plazo` en alta.
- Calendario: fechas locales, 42 celdas, feriados existentes, cambio de mes/selección, hoy/semana/mes, mismos seis filtros y mismos cálculos. Prioridades y métricas siguen sin filtrar. No se incorpora calendario legal nuevo.
- Formularios reales de alta/edición de Agenda conservan sus campos, valores y validaciones; no se sustituyen por el formulario demostrativo del HTML. La creación conserva la sección desplegada existente, ahora clara.
- Comprobación mecánica guardada: cuerpo de autenticación/consultas/derivaciones de Inicio y estado/handlers anteriores al JSX de Agenda/Agente coinciden con la base. Sin cambios en server actions, SQL, variables, dependencias, configuración de deploy o datos.

## Validación

- 27 pruebas unitarias nuevas: Inicio 8, Agente 9, Agenda 10. Suite completa acumulada: 948 pruebas en 81 archivos aprobadas. Conserva advertencias previas de las herramientas y mocks.
- Typecheck, lint, build y diff revisados. Evidencia en el respaldo; no reemplaza compuertas remotas ni habilita Ready/merge.
- 820 comprobaciones Chromium locales aprobadas en 14 escenarios × cinco anchos (320,390,768,1024,1440), con componentes reales, shell real y contexto/acciones simulados. Incluye rubros inmobiliaria/jurídico/notarial, auditor, vacíos y textos largos; sin HTTP(S) ni acceso a backend.
- Se prueban rutas/recortes de Inicio; envío, historial, error y geometría del composer; filtros, mes/42 celdas, selección, detalle, Escape/foco, permisos visibles y conservación del borrador de Agenda. CRUD se comprueba con mocks unitarios; no se hicieron escrituras reales.
- En la primera pasada se detectó retorno de foco perdido por crear el listado dentro del render como componente nuevo. Se dejó como helper de render estable; repetición de la matriz: cero fallos. Otros fallos iniciales fueron aserciones del laboratorio (etiqueta del avatar, contrato crudo de alta y tipos de Testing Library), no cambios de permisos para hacer pasar pruebas.
- Capturas de páginas completas normales a 390/1440 y detalle en viewport. El laboratorio registra scroll cero y posición de cabecera antes de capturar; se evita confundir un scroll suave en curso con un fallo del marco fijo.
- Esto no es Preview autenticada, auditoría WCAG integral, prueba RLS ni dispositivo físico. Los roles del fixture no prueban el servidor.

## Continuidad

Sigue Listados V1 y ficha completa con cabecera/pestañas, Resumen V2, Documentos V1.1, Cronología V1 y Checklist V1.1; después el resto del inventario en UI-V3-INTEGRACION.md. Publicación conjunta final en la misma rama y Preview protegida tras validar los módulos. No se reabren diseños ya aprobados.

## Skills y recursos

Se releyeron AGENTS, DESIGN_GUIDELINES y la política local. anti-ui-slop/reference/polish.md y criterios pertinentes de emil-design-eng se usaron como asesoramiento de conservación, foco y movimiento reducido; no se siguieron instrucciones de ampliar el alcance. No se instalaron paquetes, descargaron reglas ni consultaron catálogos externos. La maquetación aprobada es la fuente visual, no una nueva exploración estética.
