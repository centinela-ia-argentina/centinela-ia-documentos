# Bloque 4A — Biblioteca documental V2

## Alcance y estado
Traslado local de la versión V2 ya aprobada, sin rediseño ni nueva aprobación. Referencia: Biblioteca-documental-V2.html, REVISION.md, HALLAZGOS.md, biblioteca.js y diseno.css del paquete aprobado. V1 es antecedente histórico, no el diseño aplicado.

Colección a la izquierda y contexto seleccionado a la derecha; encabezado editorial, fechas para revisar, búsqueda GET y filtros de análisis. En móvil se alternan colección/contexto con retorno del foco al documento seleccionado. Seleccionar no abre el visor, analiza ni modifica archivos. Abrir en visor es una acción explícita. Formato, tamaño, sensibilidad, vencimiento y estado IA no se presentan como certificación profesional.

Se trasladan DocumentLibrary.tsx y su CSS module; documentos/page.tsx conserva autenticación, consultas, filtros, contadores y URLs. Solo captura además los errores de lectura para no presentar un error como lista vacía o como análisis pendiente. Los objetos cliente no incorporan file_path ni organización. No se inventa el contador de la vista inactiva, pues la consulta original carga una vista a la vez. DocumentRowClient y AnalyzeButton originales permanecen intactos, aunque esta página usa ahora la nueva composición.

Los helpers existentes gobiernan controles por rol: carga/análisis según permisos, archivo para usuarios permitidos y borrado restringido. No es auditoría de autorización servidor. Análisis, archivo/restauración y borrado conservan sus acciones y FormData originales. Sin cambios optimistas ni éxito ficticio. El borrado requiere diálogo humano nativo, foco en Cancelar, Escape y retorno del foco. El estado pendiente evita reiterar la acción mientras se procesa.

## Límites y hallazgos pendientes
- BIB-01: se mejora la presentación del error de lectura y del estado IA desconocido; no se declara reparada toda la cobertura del backend. Si falla IA, Todos conserva la consulta de archivos; los filtros IA no se presentan como confiables.
- BIB-02: controles visuales alineados con helpers existentes; políticas y autorización servidor intactas.
- BIB-03: resultados de mutación y borrado parcialmente fallido/no atómico siguen sujetos al contrato existente. No se reparó su manejo servidor ni se agregaron éxitos simulados.
- BIB-04: DOCX puede participar del contador heredado Pendientes IA, pero no recibe acción directa de análisis. No se cambió la fórmula del contador ni la lista de MIME admitidos.
- Carga V1.1 y Visor V1 todavía no trasladados. El grupo Biblioteca/Carga/Visor es parcial: continúan los 5 bloques grandes de planificación, no cinco pantallas ni cinco entregas fijas.
- AutoMatchTrigger original de la ficha no se modificó; FCK-01 continúa pendiente. No confundir ausencia de servicios en fixtures con ausencia de escrituras automáticas en la aplicación real.
- Auditoría actual: 2 paquetes críticos, Next.js y DOMPurify. Dependencias intactas; remediación pendiente antes de publicar.

## Validación local
- 23 pruebas unitarias nuevas; suite acumulada: 1222 pruebas en 90 archivos, aprobadas.
- Typecheck, lint, build y git diff --check aprobados. Advertencias previas de herramientas no equivalen a fallos ni a salida sin advertencias.
- 15 comparaciones exactas de preservación: lógica servidor salvo captura de errores de lectura, acciones, componentes anteriores, helpers, dependencias y cuatro archivos acumulados de ficha.
- Chromium local: 3837 comprobaciones, 135 recorridos, cero fallos finales, errores de página o solicitudes externas. Tres rubros, nueve escenarios y cinco anchos (320, 390, 768, 1024, 1440).
- 15 capturas de componentes reales en fixtures con datos y acciones ficticios. No son rutas completas autenticadas ni prueba E2E/RLS, CI remota o deployment.
- Incidencias corregidas: especificidad CSS del mínimo de 44px de filtros; espera del foco tras requestAnimationFrame en el harness; consulta del harness a filtros ocultos al entrar al contexto móvil. Se conservan logs iniciales y resultado final por separado. Se detuvo un recorrido local anterior huérfano para evitar resultados escritos en paralelo.

Sin commit, push ni despliegue. Base de datos, Storage y proveedores de IA sin acceso desde estas pruebas. Sin nuevas dependencias, variables, SQL ni cambios en main/Production. El respaldo acumulado contiene código, originales, parche aplicado a copia limpia, hashes, pruebas y evidencia; la Preview antigua sigue sin actualizar.
