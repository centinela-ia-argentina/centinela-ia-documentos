# Bloque 3B — prioridad de Resumen V2 y controles de lectura

## Estado

Integración **local y parcial** del interior de la ficha, sobre los bloques 1, 2 y 3A. Misma base `ae1a5652d4965cb7012fe32886c52ce8ac6a7220`, destino previsto `feat/anulus-shell-inmobiliaria`. Sin commit, push ni nuevo deployment. No se declara migración completa del Resumen ni de la ficha.

Fuente visual: <mention url="https://app.notion.com/p/d929b31628364f9e8d619bdfa126b5a2">Resumen V2 aprobado</mention> y <mention url="https://app.notion.com/p/73df5c966d454c8f8997168ed017f1c3">Controles y flechas aprobados</mention>. Sin rediseñar ni pedir otra aprobación.

## Traslado realizado

- `CopilotoExpediente`: estilos propios neutros en `SummaryPriority.module.css`, lectura guardada identificada como tal, título con icono Phosphor, acción de generación/actualización de 44 px, detalle nativo con CaretDown vectorial de 16 px y foco visible. Partes, puntos clave, riesgos, próximas acciones y fecha real de generación se conservan. Colores solo semánticos para alertas/próximas acciones.
- `RadarPlazos`: presentación neutra, cuatro niveles semánticos identificados también con texto, títulos largos sin truncar, control Cargar a agenda de 44 px y estados cargando, en agenda, ya existente y reintentar. Mensaje vacío conservado.
- Agente contextual: reemplazo de iconos del control de apertura por Phosphor y caret de 16 px. Ciclo de vida intacto: no se monta hasta abrir, se mantiene montado al plegar y conserva borrador; no se envía consulta automáticamente. **Su interior visual aún no se trasladó.**
- Edición de datos: reemplazo del triángulo `▸` por CaretDown 16 px centrado y alineado a la derecha; foco visible y asociación explícita de etiquetas con Estado/campos de metadatos. No se convirtió a otro formulario/modal: se conserva el `details` nativo, condición inicial de apertura, montaje del formulario y borradores.

## Preservación

Comparación contra copia previa: consultas, autenticación y derivaciones de la ficha sin cambios. El archivo completo de la ruta solo difiere en importación/caret/foco y atributos de asociación de etiquetas. Por tanto, acciones, payloads, permisos y las otras pestañas permanecen intactos.

- Misma `generarResumenExpediente.bind(null, caseId)` y misma condición de visibilidad `puedeUsarIA`. Sin generación al montar.
- Mismos filtros, ventana temporal, orden, deduplicación, conteo y helpers del radar. Misma llamada explícita a `guardarPlazoDetectado` y payload por rubro, manejo de respuesta/reintento sin cambios.
- No se añadieron permisos de producto, consultas, modelos ni acciones IA. No se tocaron server actions, SQL/RLS, esquema, variables ni dependencias.
- La composición general y los adaptadores heredados de datos, herramientas y cuerpo del agente siguen existiendo; los nuevos estilos de prioridad no equivalen a haber migrado esas secciones.

## Validación

- 1.000 pruebas unitarias aprobadas en 83 archivos: 23 nuevas de este tramo. Regresión específica de resumen/cliente/agente: 44/44.
- Typecheck, lint, build y diff-check aprobados. El build es compilación local, no despliegue ni QA autenticado.
- Browser: **1935 comprobaciones aprobadas, cero fallas, errores de página o solicitudes HTTP**; resultado final en `browser.json`; 18 escenarios de componentes por 5 anchos (320, 390, 768, 1024, 1440), 90 ejecuciones. Componentes reales de prioridad, agente, shell, cabecera y tabs con acciones/contexto ficticios y bloqueo de HTTP. Los datos laterales y herramientas son marcadores de ensayo explícitos, **no** prueba del formulario real ni de herramientas completas.
- Prueba de agenda y resumen solo con acciones simuladas. No se hicieron escrituras de prueba en la base actual, ni QA RLS, CI remota o Vercel.
- Advertencia previa de React/jsdom por atributo `jsx` del agente contextual conservada; no se declara salida sin advertencias ni certificación WCAG.
- Incidencias del arnés: ruta inicial de Playwright incorrecta; mock de error incompleto corregido para respetar el tipo; primera medición de caret leía geometría en dos instantes durante desplazamiento/fuentes. Se cambió a medición atómica con fuentes listas. No se cambió el producto para esconder ese resultado; informe inicial preservado.

## Seguridad: resultado actual, no extrapolar auditorías anteriores

La auditoría actual `npm audit --omit=dev` reporta **2 paquetes con severidad crítica**, con varios avisos: **Next.js 16.3.8** (directa) y **DOMPurify 3.4.16** (transitiva). `package.json` y `package-lock.json` coinciden con la base; esta intervención no los modificó. Es un reporte de dependencias, no prueba de explotación ni de filtración de datos.

Los informes de cero vulnerabilidades de bloques previos son históricos y **no representan la auditoría actual**. No se ejecutó `npm audit fix` ni se actualizaron dependencias silenciosamente. Revisar avisos, actualización compatible y regresión de seguridad antes de publicar; no presentar este paquete como aprobado para deployment. Informe completo en evidencia `audit.json`.

## Pendiente inmediato

1. Trasladar completamente datos/edición, vinculación de propiedad, WhatsApp, interior del agente contextual y herramientas reales de Resumen V2, sin sustituir sus acciones por enlaces de muestra.
2. Documentos V1.1, Cronología V1 y Checklist V1.1 dentro de la ficha; resto del inventario de pantallas.
3. Resolver o evaluar explícitamente las alertas de dependencias y validar el conjunto completo antes de publicar la Preview protegida de la misma rama. Sin main/merge/Production ni intervención sobre la base actual.
