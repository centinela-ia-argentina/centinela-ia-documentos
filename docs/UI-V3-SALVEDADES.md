# UI V3 — cierre funcional acotado posterior a E2E

## Autorización y alcance
El usuario autorizó avanzar con la recomendación de no modificar el checklist al abrirlo y revisar los resultados de las operaciones documentales. Misma rama `feat/anulus-shell-inmobiliaria`, PR #26 Draft y Preview protegida. No merge ni Production. Sin SQL, políticas/RLS, roles, dependencias ni servicios reales de QA.

Base remota verificada: `555035fb69961958276b2002e1f1c16b4c11140c`. Sus 210 E2E aprobados son evidencia histórica: no aprueban automáticamente este nuevo parche funcional.

## Cambios
- **FCK-01, montaje:** se retira AutoMatchTrigger de la composición real de la ficha. Tabs monta contenidos ocultos: el efecto podía dispararse incluso sin seleccionar Checklist. Ahora abrir ficha, alternar pestañas o recargar no invoca esa detección. El botón manual existente y su confirmación se conservan, al igual que la guarda servidor y las decisiones manuales/revisadas/no requeridas. No se cambia el algoritmo de coincidencias ni la etiqueta histórica Auto (IA).
- **FD-02/BIB-03, borrado:** ambas entradas comparten limpieza con comprobación de errores en lectura, Storage, fragmentos, análisis, checklist y documento. Se detiene al primer fallo; la última eliminación exige una fila confirmada. Lookup y borrado final están acotados por organización y, desde ficha, también por case_id. Desvinculación de checklist ahora incluye organización y limpia match_source.
- No se genera auditoría de eliminación exitosa si falla la limpieza. Un fallo de auditoría posterior a la eliminación se informa por separado, sin pedir al usuario que repita un borrado que ya ocurrió.
- La UI distingue eliminación completa, no confirmada, potencialmente parcial y auditoría no confirmada. No expone rutas privadas ni mensajes del proveedor. El botón de ficha espera realmente la promesa de la acción y permanece deshabilitado durante ella.
- Archivo/restauración verifican error y fila actualizada antes de auditar; cero filas no se interpreta como éxito. Auditoría fallida tiene aviso propio.
- **FD-03, lectura:** una consulta fallida de documentos de ficha se presenta como error, no como cero documentos. Biblioteca ya distinguía error de vacío.

## Límites explícitos, no nuevos bloqueos visuales
- Storage y Postgres **no constituyen una transacción única**. Este parche no promete rollback ni atomicidad: una interrupción puede dejar limpieza parcial. Se conserva la fila hasta la última etapa y se informa la incertidumbre para inspección/reintento autorizado. Una garantía transaccional entre servicios exigiría otro diseño (trabajo persistente/compensación), no una migración visual ni un falso éxito.
- Se retira únicamente la detección automática por montaje. La coincidencia existente tras **subir** archivos mediante carga múltiple sigue siendo un efecto de esa acción explícita; no se alteró el flujo de carga en este ajuste.
- FU-03: reintentos de carga usan los metadatos actuales, como informa el formulario; no se añadió un snapshot por archivo.
- BIB-04/FCK-02: contador heredado de pendientes para formatos sin análisis directo y etiqueta de origen histórica se conservan con explicación visible; no se inventa una nueva clasificación.
- FC-02/FC-03 de Cronología (día UTC/filtro de borrado por ID+organización) no se declaran reparados ni vulnerabilidades confirmadas por este parche. Permanecen fuera del cambio documental; los checks de autorización siguen siendo obligatorios.

## Validación
- Local, parche final: **1.380 unitarias / 102 archivos**, tipos, lint y build aprobados; 52 pruebas más que el candidato anterior. Incluye fallos y excepciones en cada etapa, cero filas, tenant/case, denegación por rol, auditoría y mensajes/pending/lectura. Proveedores simulados: no acredita borrados reales.
- Regresión E2E N ampliada: documento y requisito coincidentes en fixture por navegador; abrir/alternar/recargar debe conservar Pending y no emitir acciones; abrir confirmación tampoco modifica; confirmar detecta, vincula y persiste Received/automatic. Conserva las verificaciones originales de vínculo manual, recarga, desvinculación y reversibilidad.
- Fixture E2E solo permite loopback y Supabase efímero. No se ejecutan pruebas destructivas en Preview ni contra datos reales.
- Pendiente: todos los gates de CI y Vercel/protección **sobre el SHA nuevo**, sin reutilizar los verdes anteriores.
