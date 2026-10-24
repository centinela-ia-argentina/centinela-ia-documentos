# Anulus — inventario UI/UX y archivo visual recuperado

## Cómo leer el estado

Base de esta revisión: `main` en `f2175b6cc8f8aca9897e39d134def1996423fac1`, que fusionó PR #26. Ese conjunto contiene la integración V3. Las notas de cada bloque conservan el estado local de cuando se escribieron: sus frases «sin push» o «pendiente» no describen por sí solas el estado posterior a la fusión.

Integrado no significa que cada píxel haya sido cotejado con cada muestra aprobada en producción. El reporte del usuario identifica dos defectos reales del marco compartido. Esta revisión los corrige en una rama separada, sin reemplazar Production. La portada pública y el acceso no formaron parte de la migración integral al tema claro.

## Qué se tocó por sección

| Sección / pantalla | UI y UX trasladados | Límite importante |
| --- | --- | --- |
| Marco común, todas las secciones | Navegación clara por rubro y rol, grupos plegables, cuenta inferior, cabecera compacta, menú móvil modal, foco y Escape. Botones, tipografías, superficies, selectores/flechas y pestañas compartidas. | La corrección actual elimina el marco exterior de maqueta y la cabecera superpuesta. No elimina las tarjetas que agrupan información dentro de las pantallas. |
| Inicio | Saludo/fecha, cuatro indicadores, lista compacta de operaciones/expedientes, accesos de trabajo y primeros pasos. | No se inventaron métricas ni se cambió su fórmula. |
| Agente general | Identidad/avatar, orientación, sugerencias, conversación, errores y compositor adaptable con envío por teclado. | Se conservaron animaciones y servicios existentes; no se creó un motor IA nuevo. |
| Agenda | Calendario protagonista, filtros, prioridades, detalle modal, alta/edición y confirmaciones; movimiento reducido. | Mismas reglas y fechas del calendario existente. |
| Operaciones / Expedientes / Legajos: listados | Tabla/filas móviles, búsqueda, activas/archivadas, documentación, fechas, paginación y menú de acciones. | Consultas, permisos y destinos conservados. |
| Ficha: cabecera y administración | Breadcrumb, identidad/estado/cliente, pestañas y Administrar cerca del encabezado; confirmaciones accesibles. | No se convirtió un botón de demostración en una función nueva. |
| Ficha: Resumen | Jerarquía datos → resumen ejecutivo → radar → consulta contextual → herramientas. Detalle del resumen plegable, avisos y estados vacíos. | La IA se solicita mediante sus acciones; no se fabrica un resumen al abrir. |
| Ficha: datos / propiedad / WhatsApp | Lectura separada de edición, propiedad vinculada y mensajes preparados mediante acción explícita. | No se envían mensajes automáticamente. |
| Ficha: agente contextual | Conversación, memoria existente, propuestas sujetas a aprobación y compositor; borradores y teclado. | No se autoejecutan propuestas por mostrarlas. |
| Ficha: herramientas del rubro | Cotejo, borradores, riesgos/alertas y acciones sectoriales de inmobiliaria, jurídico y escribanía; resultados y advertencias diferenciados. | Los cálculos y servicios existentes no pasan a ser asesoramiento profesional certificado. |
| Ficha: Documentos y consulta con fuentes | Lista prioritaria, sensibilidad, acciones separadas, consulta plegable con respuesta/fuentes, aportes y notas. | Permisos y confirmaciones preservados. |
| Ficha: Cronología | Línea de hitos, origen explícito, filtro, alta manual y confirmación al quitar un registro manual. | Quitar un movimiento no elimina el archivo ni un evento de Agenda. |
| Ficha: Checklist | Progreso aplicable, estados, requisitos, gestión plegable y vinculación; confirmaciones diferenciadas. | Cierre funcional posterior: abrir la ficha ya no dispara la detección automática de vínculos. La detección manual continúa disponible. |
| Documentos: biblioteca general V2 | Colección y contexto del archivo seleccionado, búsqueda/filtros, activos/archivados, selección separada de Abrir en visor, foco móvil. | Seleccionar no abre ni analiza por sí solo. |
| Documentos: carga V1.1 | Destino/metadatos, selección/cola, estados por archivo, duplicados, errores, reintento y resultado agregado. | Reintentar usa los metadatos actuales; la carga y el análisis son acciones distintas. |
| Documentos: visor V1 | Vista previa principal, panel Detalles/Análisis, vínculo, acciones de original/descarga y menú administrativo; error de acceso temporal explícito. | El PDF utiliza controles nativos. No obtener el enlace no se presenta como formato incompatible. |
| Herramientas documentales | Catálogo Archivos/Texto y espacio activo: imagen→PDF, unir/comprimir PDF, convertir imágenes y utilidades de texto; estado conservado entre herramientas montadas. | Guardar en Documentos es una carga separada. PDF.js puede descargar un componente externo. |
| Modelos sectoriales | Catálogo/búsqueda persistentes, Completar datos → Revisar borrador, faltantes, prellenado, IA opcional, revisión de escrito propio separada y Copiar/TXT/DOCX. | Plantillas orientativas, no documentos certificados ni asesoramiento jurídico. |
| Alquileres V1.1 y nuevo contrato V1 | Lista/radar, filtros, ficha de consulta, edición explícita, monto/ajuste sugerido/propiedad vinculada, índices y formulario dividido por datos/ajuste/fechas. | Registrar no genera el instrumento contractual ni aplica ajustes automáticamente. |
| Clientes | Alta/edición: contacto, búsqueda y presupuesto; ficha de lectura/edición y matching; listado integrado al lenguaje común. | Crear un cliente no crea un contrato ni inicia contactos o búsqueda automática. |
| Panel inmobiliario | Cuatro accesos/indicadores, revisión de ajustes y asistente de cartera separado. | Se conservó su composición funcional; no se inventaron nuevos indicadores. |
| Propiedades | Lista, alta y ficha con Ficha/Comercial/Tasación y comparables/Vínculos, datos legales, edición explícita, modal de comparable y resultados IA legibles. | Estimación orientativa, no tasación oficial. Composición y negocio existentes conservados. |
| Nueva operación | Wizard de tres pasos, selección de tipo/estado, vinculación, condiciones, resumen y validaciones; adaptación móvil y círculos de paso estables. | No sustituye las altas propias de jurídico/escribanía. |
| Buscar y Gestión: Ajustes, Observaciones, Reportes, Usuarios | Reciben el marco y controles compartidos cuando son sus consumidores. | No consta en estos bloques un rediseño individual completo de cada una de estas páginas; no se presenta como si tuviesen una nueva muestra específica integrada. |
| Landing, login y recuperación de acceso | No migrados integralmente al tema claro de la aplicación interna. | Que la landing conserve otra composición no prueba que el dashboard tenga código antiguo. |

## Cambios funcionales separados del diseño

El cierre de PR #26 también retiró la detección de checklist por montaje, verificó resultados de borrado/archivo/restauración y distinguió errores de lectura de documentos de listas vacías. No se promete atomicidad entre Storage y Postgres; un fallo puede dejar limpieza parcial y ahora se informa. Ver `UI-V3-SALVEDADES.md`.

## Qué se recuperó para comparar

- 37 ZIP locales examinados, más carpetas de evidencia local de los distintos bloques.
- 474 imágenes distintas por SHA-256: 341 registradas primero en respaldos de propuestas/versiones, 132 en pruebas de integración y una referencia externa identificada como tal.
- 653 apariciones de origen conservadas en `procedencia.csv`; las copias idénticas se guardan una sola vez.
- Los PNG/JPG originales no se recrearon ni redimensionaron. El PDF es un índice con miniaturas recortadas, no reemplaza la imagen completa.
- Se incluyen versiones anteriores reemplazadas y variantes de QA que quizá no se mostraron en el chat. La categoría de archivo no prueba aprobación individual. No es posible asegurar que estén absolutamente todas las imágenes compartidas en el historial; son todas las recuperables de las fuentes examinadas.
- Las nuevas capturas de esta corrección van separadas, con datos ficticios y componentes reales sin backend. No son capturas de producción ni una nueva aprobación de diseño.

## Qué falta en esta revisión

1. Revisar visualmente el ajuste del marco en Preview y compararlo con las capturas, sin confundir el prototipo con la aplicación real.
2. Completar las compuertas remotas del SHA nuevo, incluida la regresión autenticada en navegadores.
3. Fusionar y desplegar únicamente después del cierre correspondiente; verificar el dominio visible correcto. Esta revisión no fusiona ni promueve Production.
4. Un cotejo pantalla por pantalla de todos los diseños aprobados frente a producción no está acreditado por este inventario ni por la cantidad de tests.

Fuentes de código: PR #26, `UI-V3-INTEGRACION.md`, `UI-V3-BLOQUE2.md`, bloques 3A–3H, 4A/4BC/4D, 5, 6 y `UI-V3-SALVEDADES.md`. Estos documentos son registros de etapas, no sustituyen la verificación del SHA y del dominio actuales.
