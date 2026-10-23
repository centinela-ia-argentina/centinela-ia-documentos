# V3 · Bloque 3A — Listados V1 y marco de ficha

## Estado y autorización
Implementación local sobre ae1a5652d4965cb7012fe32886c52ce8ac6a7220, continuidad de la misma rama `feat/anulus-shell-inmobiliaria`. Se acumula a los bloques 1 y 2. Sin commit/push/despliegue. La migración integral NO está terminada y este paquete parcial NO debe publicarse como conjunto válido.

El usuario autorizó trasladar las versiones ya aprobadas, sin rediseñar ni solicitar nuevas aprobaciones. No se modifican base de datos, variables, dependencias, acciones servidor, permisos servidor, main ni Production.

Referencias:
- <mention url="https://app.notion.com/p/fabfd817d5304ed3acbb2fede0afdbf6">Listados V1</mention>
- <mention url="https://app.notion.com/p/a31fc9fa6de549f9b32ad7827fae75a6">Ficha de registro: cabecera y estructura</mention>
- <mention url="https://app.notion.com/p/d929b31628364f9e8d619bdfa126b5a2">Resumen V2: traslado completo aún pendiente</mention>
- <mention url="https://app.notion.com/p/8062f37870bc488d9199ee4a654856ba">Registro de integración y respaldos</mention>

## Antes / después / motivo
| Antes | Después | Motivo |
| --- | --- | --- |
| Filas oscuras inmobiliarias y tarjetas jurídicas/notariales | Tabla V1 común, adaptada a filas móviles y a cada rubro | Trasladar la presentación aprobada, con Abrir visible y títulos completos |
| Menús heredados oscuros con distinto tratamiento | Diálogo neutral de acciones, teclado, Escape y retorno al disparador | Patrón aprobado sin copiar botones explicativos de maqueta como funcionalidad |
| Encabezado de ficha con gradiente y navegación con emoji | Identidad, estado/tipo, cliente, breadcrumb y cuatro pestañas con Phosphor | Coherencia con marco V3 ya integrado |
| Zona administrativa al pie | Administrar junto al encabezado, con las mismas guardas y formularios reales | Separar lectura y acciones administrativas |

## Contratos conservados
- CasesPage mantiene byte por byte el cuerpo previo a render: autenticación, organización, rubro estricto, tipos canónicos, búsqueda validada en servidor, estado, orden SQL triple, límite 25, conteo, redirecciones de rango/página y carga de checklist/roles.
- OperationsListView ahora recibe el rubro; configuración y términos actuales del repositorio prevalecen sobre etiquetas estáticas antiguas. Inmobiliaria conserva Operaciones. No se fija el viejo título jurídico «Gestión de Casos» si la configuración actual devuelve «Gestión de Expedientes».
- Búsqueda GET por título/cliente/tipo; rawQ, estado y page mantienen su contrato. Activas/Archivadas conservan sus destinos (cambio de archivo reinicia búsqueda como antes); limpiar conserva archivo. No búsqueda instantánea, nuevos filtros, acciones masivas ni IA.
- Semántica documental: inmobiliaria fulfilled/total y porcentaje/barra; otros rubros Completo / Sugeridos total-missing/total / Sin checklist. Fechas y etiquetas usan los helpers actuales. No se cambia cálculo.
- Acciones originales archiveCase/unarchiveCase/deleteCase, campos case_id, guards de admin/employee/lectura y confirmaciones completas. No se ejecuta ninguna al abrir/cerrar. Mensaje inmobiliario y mensaje jurídico/notarial conservados por separado.
- CaseAdministration extrae los formularios actuales de la ficha: mismo estado `!== 'archived'` para archivar/desarchivar, canArchiveCase/canDeleteCase, términos y DeleteCaseButton original (incluye pending/confirmación).
- Ficha: cuerpo previo a render y contenido de las cuatro pestañas permanecen byte por byte iguales, salvo sus cuatro etiquetas. Tabs compartido conserva montaje/URL/borradores y navegación por teclado del bloque 1. Esta etapa NO modifica contenido, side effects ni handlers interiores.
- CaseCardMenu histórico queda intacto, aunque el listado común ya no lo consume. No borrar otros consumidores por inferencia.

## Allowlist del tramo
Modificados:
- src/app/expedientes/page.tsx
- src/app/expedientes/[id]/page.tsx
- src/app/operaciones/OperationsListView.tsx
- src/app/operaciones/OperationsRowMenu.tsx

Nuevos:
- src/app/operaciones/RecordList.module.css
- src/app/operaciones/recordListV3.test.ts
- src/components/records/RecordDialog.tsx y RecordDialog.module.css
- src/components/records/CaseDetailHeader.tsx y CaseDetailHeader.module.css
- src/components/records/CaseAdministration.tsx
- docs/UI-V3-BLOQUE3A.md

Se actualiza docs/UI-V3-INTEGRACION.md para reflejar avance parcial. Sin otras ampliaciones nuevas al paquete; cambios de bloques previos conservados.

## Validación
- 977 pruebas unitarias aprobadas en 82 archivos, incluidas 29 nuevas de listado/cabecera/administración.
- Typecheck, lint, build de producción y git diff --check aprobados sobre la versión final.
- npm audit --omit=dev: cero vulnerabilidades reportadas; no afirmación sobre dependencias de desarrollo.
- Chromium local: 2.331 comprobaciones aprobadas, 36 escenarios × cinco anchos (320/390/768/1024/1440), cero errores de página y solicitudes HTTP/backend.
- Listado: tres rubros × normal/lector/operador/vacío/textos extensos/archivado/error de carga/error de conteo/búsqueda inválida. Cabecera: tres rubros × normal/lector/textos extensos. Componentes reales, contexto/acciones sustituidos solo en el bundle del fixture, fuera del repositorio.
- Comprueba overflow de página/diálogo, destinos, GET, archivo, paginación, guardas visibles, apertura sin mutación, cancelación de confirmación, foco de entrada/ciclo/retorno, Escape, barra inmobiliaria visible, cuatro pestañas, URL/teclado y conservación de borrador.
- Capturas inspeccionadas: listado inmobiliario escritorio/móvil, jurídico escritorio, acciones móvil, cabecera con Administrar y caso de textos extensos a 320px. Las restantes capturas son evidencia generada, no inspección humana individual de todos los escenarios.

### Correcciones durante verificación
- Fixture de prueba TypeScript incompleto: se completaron todos los campos de CaseRecord, sin cast inseguro nuevo. Role de CaseAdministration se tipó como UserRole.
- Primer selector de foco del fixture apuntaba al dialog cerrado de navegación móvil; se acotó al dialog[open]. No era un fallo del producto.
- Recorrido Tab de diálogo con una sola acción podía pasar al chrome del navegador: se agregó ciclo explícito primero/último, manteniendo showModal nativo, Escape y restauración al disparador.
- Barra aprobada usa un contenedor span en React: se añadió display:block para que sus dimensiones se apliquen. No se cambió porcentaje.
- Espacio residual de la extracción quitado. Validaciones completas repetidas después.
- Una repetición completa falló en la prueba preexistente de PropertyWorkspace (esperaba una dirección sugerida). Esos archivos no cambiaron en este tramo; la prueba aislada pasó 10/10 y la siguiente suite completa pasó 977/977 sin modificarla. Se conserva el log del incidente. Causa no diagnosticada: no se declara eliminada la intermitencia ni se amplía el alcance a Propiedades.

## Límites y pendientes
NO son E2E autenticados, prueba de autorización servidor/RLS, CI remota, Vercel ni certificación WCAG. No se han hecho escrituras contra la base actual. Las acciones ejercitadas en pruebas son mocks.

LS-01 (CTA alta visible al lector), FR-01 (AutoMatchTrigger montado en pestaña oculta), FR-02 (guardas interiores), FR-03 (initial tab inválido) y demás hallazgos previos no se reparan silenciosamente. Se preservan los contratos actuales. El diálogo mejora esta interacción, no certifica todos los menús heredados.

Pendiente inmediato: interior completo de Resumen V2, Documentos V1.1, Cronología V1 y Checklist V1.1, preservando las funciones reales y sus permisos. Luego biblioteca/carga/visor/herramientas/modelos/alquileres y formularios según inventario. Solo cuando el conjunto esté preparado y validado se publica en la misma rama y Preview protegida, sin merge ni Production.
