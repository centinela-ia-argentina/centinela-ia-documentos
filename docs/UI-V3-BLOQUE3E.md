# Bloque 3E — herramientas sectoriales de Resumen

## Alcance y estado
Traslado local de las herramientas de la ficha al lenguaje aprobado en Resumen operación V2 (Notion d929b31628364f9e8d619bdfa126b5a2). Se respeta el orden y las versiones aprobadas, sin rediseño ni otra ronda de aprobación. Misma base y destino `feat/anulus-shell-inmobiliaria`; sin commit, push, deploy, main, Production ni escrituras en la base actual. No incluye el catálogo general de Herramientas ni declara migradas Documentos, Cronología o Checklist.

## Implementación
- `CaseIndustryTools` separa presentación de la ruta, sin consultas propias ni efectos: resultados legales (liquidación, plazo, tasa), cotejo de los tres rubros, escritura, UIF/PLA y ROS, precalificación de alquiler, contratos/modelos, reserva/boleto, aviso comercial y derivación compatible.
- Filas separadas, iconos Phosphor, acciones de mínimo 44 px, campos etiquetados, foco visible, texto largo ajustable y estados semánticos acompañados de texto. Los borradores mantienen texto escapado y un área de lectura desplazable de hasta 384 px, sin alterar el contenido.
- `IndustryTools.module.css` queda aislado del adaptador legado mediante `toolsV3` y exclusiones de especificidad cero. No cambios globales de botones, disclaimers o selects. Se conserva la flecha nativa de los selects usando `background-color`, no un shorthand que borre su imagen.
- `DerivationView` presenta el formulario/historial; su padre conserva la consulta original y el action original. Precalificación incorpora etiquetas asociadas, sin cambiar nombres ni valores del formulario.
- Se reemplaza el carácter corrupto del botón de calificación y emojis de controles por texto/iconos consistentes. En cotejo se evita duplicar el marcador CSS sobre la viñeta textual existente, conservando lista accesible y contenido.

## Contratos conservados
29 comparaciones exactas registradas en `preservation.json`: cuerpo de ruta anterior a herramientas (autenticación, consultas, cálculo de datos y JSX), resto posterior de la ficha, consulta de derivaciones, handler completo de exportación ROS, actions servidor, permisos/configuración por rubro, fechas canónicas, motor IA y archivos de dependencias. Los resultados se formatean, no se recalculan. Importes históricos de intereses no se agregan a la vista; se conserva la indicación de intereses no calculados. Payload UIF y extracción de fecha de boleto, rutas a modelos, binds, campos y selección de moneda se mantienen.

Las guardas de UI son las existentes, no una nueva autorización: cotejo, redacción y UIF respetan su condición anterior. Precalificación y derivación **ya carecían de una guarda de rol en su propia UI**; se conserva esta visibilidad, incluidos fixtures de lector, sin declarar solucionado un hallazgo. Sus acciones servidor siguen intactas y conservan los controles de acceso existentes. ROS sigue visible con análisis guardado; no exporta automáticamente. No se ejecutó IA, impresión real, envío, derivación ni publicación comercial contra servicios reales.

## Validación
- 44 pruebas nuevas; suite acumulada: **1093 pruebas en 86 archivos**.
- Typecheck, lint, build de producción y `git diff --check`: aprobados. Auditoría sin modificar paquetes: 2 vulnerabilidades críticas reportadas en Next.js y DOMPurify, como antes; remediación pendiente antes de publicar.
- Chromium local: 3 rubros × 6 escenarios (guardado, vacío, texto largo, lector, alquiler y tipo incompatible) × 5 anchos (320, 390, 768, 1024 y 1440): **1385 comprobaciones / 90 recorridos**, sin fallos ni errores de página o solicitudes HTTP externas. Formularios y estados pendientes contra stubs; datos ficticios, sin backend.
- 8 capturas de herramientas reales en móvil/escritorio, dentro del marco real pero recortadas a la región para legibilidad. No son evidencia de ficha completa ni de E2E autenticado, RLS, CI o Vercel.
- Incidencias de preparación: tres expectativas de cotejo omitían su viñeta textual; corregidas para comprobar el contenido exacto. En cinco recorridos de alquiler el nombre accesible de Moneda incorporaba opciones; corregida asociación/etiqueta explícita sin cambiar payload. La revisión visual detectó viñeta duplicada (lista + texto) y se aisló su estilo. Matriz repetida tras el ajuste.
- Advertencias previas del entorno (Vite CJS, JSX del tipeador y `act` en ensayos asíncronos) no equivalen a errores de suite; no se afirma salida libre de advertencias.

## Pendiente
Trasladar Documentos V1.1, Cronología V1 y Checklist V1.1 y continuar las demás pantallas aprobadas; validar el conjunto y resolver las compuertas antes de publicar una única Preview protegida. La Preview remota anterior aún no contiene esta integración local.
