# Bloque 3F — Documentos de la ficha V1.1

## Alcance y referencia
Integración local parcial en continuidad de bloques 1, 2 y 3A–3E; destino previsto `feat/anulus-shell-inmobiliaria`, sin commit/push/deploy, main ni Production. Referencia vigente: `Documentos-V1.1.html` de la entrega Cronología V1 + ajuste Documentos V1.1 (Notion ae5a0f79b3c44229a2926189530df41f), sobre Documentos V1 (f010684bb29542a7bdebd7a0ee28c3fd). No se vuelve a la columna lateral de V1 ni se solicita otra aprobación. No incluye carga, visor, Cronología o Checklist completos.

## Traslado
- `CaseDocumentsPanel`: lista primero; identidad completa ajustable, tipo, aporte cuando existe, sensibilidad textual y enlace al documento. Orden recibido intacto; «Más recientes primero» describe la consulta actual, no es un nuevo control. Vacío y observaciones conservan los datos/textos existentes.
- La consulta real `PreguntarDocumentos` se coloca debajo, plegada al inicio, a ancho completo. Respuesta y fuentes se dividen solo cuando hay espacio. Fuentes numeradas con fragmentos desplegables y caret centrado. Plegar y cambiar pestañas conserva borrador, respuesta y fuentes montadas; no genera consultas automáticamente.
- Se conserva el input de una línea y su submit nativo por Enter, en lugar de copiar el textarea ilustrativo y cambiar el contrato de teclado. Mismo trimming, guardas de vacío/pendiente, vaciado, llamada, fuentes, errores y parser de citas escapadas. Sin mínimo nuevo de tres caracteres en UI: la validación existente del servidor sigue siendo autoridad. No se inventan filtros, resultados, enlaces de fuentes o estado de análisis por archivo.
- La presentación aplica `canUploadDocument` y `canDeleteDocument` existentes: admin puede subir/eliminar, employee subir, auditor/client lectura; consulta según `puedeUsarIA` original. Esto alinea la UI con el servidor y la referencia aprobada (FD-01), no modifica autorización/RLS ni declara auditados todos los caminos.
- `EliminarDocumentoButton`: acción secundaria iconográfica con nombre accesible que abre un diálogo nativo dentro de la página. Se sustituye el `window.confirm` por confirmación explícita equivalente: nombre, archivo y análisis/búsqueda/checklist, irreversibilidad, Cancelar y «Eliminar permanentemente». Foco inicial en Cancelar, Escape/cierre y retorno al disparador. Ningún borrado al abrir/cancelar; FormData y bloque de ejecución servidor intactos. No segunda confirmación redundante.
- CSS propio y Phosphor, sin degradados/pulsos, controles de mínimo 44 px, foco visible y texto largo sin overflow. No cambios globales ni dependencia nueva.

## Preservación y límites funcionales
12 comparaciones exactas en `preservation.json`: cuerpo de ruta anterior a Documentos (auth, consultas y datos incluidos), resto de Cronología/Checklist, estados/handler de consulta, bloque FormData/ejecución de borrado, acciones servidor, diccionarios/permisos/sensibilidad y dependencias intactos frente a la base.

No DB, Storage, embeddings/IA, impresión, correos ni borrados reales. La confirmación se prueba contra un stub y conserva la lista ficticia. El action de borrado mantiene su comportamiento anterior, incluida su llamada no esperada dentro de la transición; no se promete indicador pendiente hasta completar la operación ni feedback de fallo reparado. FD-02 (resultados parciales de borrado no comprobados individualmente en servidor) y FD-03 (error de consulta confundible con vacío) siguen separados y sin reparar. No se inventa un estado de carga fallida global. La consulta documental conserva errores ya devueltos por su action.

## Validación
- 34 pruebas nuevas; suite acumulada **1127 pruebas / 87 archivos**.
- Typecheck, lint, build de producción y diff check aprobados al cierre. Auditoría de producción mantiene 2 paquetes críticos (Next.js y DOMPurify); dependencias intactas, revisión/remediación pendiente antes de publicar.
- Chromium local: 3 rubros × 7 escenarios (admin, employee, auditor, client, vacío, texto largo, aportes/notas) × 5 anchos (320/390/768/1024/1440): **2922 comprobaciones / 105 recorridos**, sin fallos, errores de página ni solicitudes HTTP externas. Incluye payload de consulta recortada, carga, respuesta y fuentes, errores/conexión/recuperación, borrador al plegar/cambiar pestaña, permisos de presentación, Escape/cancelación/foco y payload de borrado solo tras confirmar.
- 13 capturas de componentes reales con datos ficticios: lista, fuentes en los tres rubros y confirmación móvil. Las capturas de región no implican ficha completa. Marco/cabecera/Tabs reales; contenido de otras pestañas de ensayo, contexto/actions ficticios y red externa bloqueada. No E2E autenticado, RLS, CI ni Vercel.
- Incidencias: expectativa de sensibilidad nula corregida a «Sin clasificar» y selector de nombre escapado acotado al heading (el mismo nombre existe en diálogo cerrado); tipado de tupla de sensibilidades estrechado para compilación estricta. No se alteraron resultados ni se ocultaron fallos. Se mantienen advertencias previas de herramientas/`act` en algunos ensayos.

## Siguiente tramo
Cronología V1 y Checklist V1.1, sin rediseñar sus versiones aprobadas; luego las demás pantallas y compuertas del conjunto. La Preview remota vieja aún no contiene esta integración local; no se presenta este respaldo como deploy.
