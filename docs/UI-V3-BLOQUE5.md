# Bloque 5 — Alquileres V1.1, Nuevo contrato V1 y formularios de clientes V1

## Estado y alcance

Integración local acumulada sobre `ae1a5652d4965cb7012fe32886c52ce8ac6a7220`; rama destino `feat/anulus-shell-inmobiliaria`, worktree actual detached. No commit, push, merge, Preview nueva ni Production. No acceso a base, Storage o IA reales; no cambios de dependencias, SQL o variables.

Fuentes: carpetas aprobadas `anulus-alquileres-v1.1`, `anulus-nuevo-contrato-v1`, `anulus-nuevo-cliente-v1`. Sus marcadores históricos de pendiente de aprobación no sustituyen la autorización posterior de integración. No se importaron controles de laboratorio ni datos de ejemplo como producto.

## Entregado

- Listado de alquileres con radar acromático, calendarios diferenciados, avatar de 40px con User de 26px centrado, búsqueda por inquilino/propiedad y Vigentes/Finalizados. Un tab **Otros** aparece únicamente si hay estados antiguos nulos/desconocidos: evita ocultar registros que antes eran accesibles; no cambia ni normaliza sus datos.
- Consulta adicional de propiedades **solo lectura**, agrupada, deduplicada y limitada a `organization_id` e IDs de contratos de la organización. Sin consultar por cada fila. Si falta nombre, no se inventa propiedad. Se conservan alcance, orden y exclusión de archivados de los contratos.
- Ficha en modo lectura primero; edición explícita con los mismos once campos y acciones. Borrador conservado al volver/cancelar; foco de regreso al botón. Auditor sin formulario de edición ni aplicación de ajuste.
- Monto actual, próximo ajuste, motivo de datos insuficientes, cálculo por índice/porcentaje fijo y aplicación existentes. `AplicarAjusteButton` permanece byte por byte, incluida confirmación y `expected_updated_at`.
- Alta/edición de contrato en tres grupos. Once nombres de campos, catálogos y defaults originales; importe e inicio obligatorios, inquilino/propiedad opcionales. Periodicidad inicial de alta 3 y fallback de edición 12, como antes.
- Fecha visible `dd/mm/aaaa`, picker nativo auxiliar sin nombre y único campo nombrado oculto ISO. Se reutiliza el parser civil existente para impedir fechas imposibles, sin desplazar de zona horaria. No nueva comparación de inicio/último ajuste ni nuevo calendario de negocio.
- Índices con formulario e historial; acciones, cuatro nombres publicados, catálogos y roles intactos. Etiquetas Mes/Año asociadas correctamente.
- Alta y edición de clientes compartiendo formulario aprobado de dieciséis campos; solo nombre obligatorio, USD por defecto, criterios visibles para todos los tipos, geografía de texto libre. Asociación explícita de cada etiqueta, incluido moneda/presupuestos/ambientes.
- Los formularios aprobados de cliente usan `editorV3`, fuera del adaptador antiguo que borraba el chevron del selector. No cambios a handlers, modo lectura, matching, WhatsApp ni criterios de evaluación.
- Textos largos sin desbordes en cabecera/propiedad y resultados responsive. Controles de 44–46px y selectores con reserva derecha44/inset14.

## Evidencia

`v3-b5-fixture` monta rutas/componentes reales y ShellFrame/Sidebar/Topbar; solo servicios/contexto/acciones están simulados. No es sesión autenticada, verificación RLS ni prueba de persistencia real.

- 59 combinaciones: 45 pantallas/roles/anchos normales +14 casos vacíos, largos, sin datos, sin índices y porcentaje fijo. Anchos320/390/768/1024/1440.
- 311 aserciones de navegador, sin fallos, errores JS ni solicitudes externas. Incluyen ausencia de acciones automáticas, filtros, legacy, permisos, borradores, campos, fechas e importes enviados a mocks, cancelación de confirmación y token de concurrencia original.
- 30 pruebas de regresión añadidas (20 formularios/fechas/filtros/lectura y10 rutas/roles/organización). Tests existentes adaptados únicamente al SVG en vez de emoji y extracción del formulario, conservando las aserciones de acceso/payload.
- Suite acumulada: **1311 tests en97 archivos, todos aprobados**. Typecheck, lint y build aprobados. Seis comprobaciones adicionales de aislamiento de estilos (buscador, chevron y acción única de edición), todas aprobadas.
- **142 controles de preservación**, incluidos124 hashes de archivos del acumulado anterior fuera del alcance. Resultados completos en logs/manifiesto del respaldo.
- Cotejo AST de autenticación/consultas/cálculos; se excluyen únicamente presentación y la consulta agrupada declarada. SHA de acciones, helpers, permisos, FormSubmitButton, dependencias y archivos del acumulado anterior fuera del alcance.

Las primeras pasadas detectaron dos incidencias reales: textos largos desbordaban el detalle y el adaptador viejo de edición borraba el chevron. Ambas corregidas antes de la pasada final. Otros fallos iniciales del fixture fueron selectores ambiguos del QA (avatar de cuenta en vez de contrato, dos h1 montados con uno oculto), no fallos del producto; fueron acotados al contenido correcto. No se ocultaron errores de navegador.

## Límites y hallazgos conservados

- AL01: listado ignora el error de consulta de contratos y puede mostrar vacío indistinguible. No reparado en esta entrega visual.
- AL02: eliminación de un valor de índice sigue sin confirmación. No se añadió una confirmación ficticia ni se afirmó resuelto.
- AL03: crear/editar alquiler no tienen idénticas restricciones de campos nulos en servidor. Mantener revisión funcional pendiente.
- NCL01: validaciones numéricas reforzadas (finitud, no negativos, mínimo≤máximo, ambientes enteros) pendientes; no se añadieron reglas en este traslado. NCL02 de asociación de etiquetas corregido en estos formularios.
- CL02: discrepancia histórica `zone`/campos geográficos del formulario no reparada mediante campo o fallback inventado.
- No se añadieron estados nuevos de recuperación de errores de acciones servidor. Se conserva el contrato nativo de formularios y FormSubmitButton/pending. Los errores de prototipos eran simulaciones, no prueba de manejo real.
- Los permisos y consultas originales de detalle/alta se conservaron; no se presenta el traslado como reparación general de autorización ni validación de políticas de acceso.
- Última auditoría disponible: Next.js y DOMPurify con alertas críticas; dependencias sin modificar. Remediación y nueva auditoría antes de publicar.

## Quedan dos grupos grandes

1. Panel inmobiliario, Propiedades (lista/ficha/alta), listado de Clientes y Nueva operación: integrar lenguaje común preservando composiciones conformes y acciones.
2. Validación integral autenticada por rubro/rol/estado, seguridad, remediación de dependencias y publicación del conjunto en la Preview protegida de la misma rama. Sin merge ni Production.

Estos son grupos de alcance, no promesa de dos turnos ni un plazo fijo. La migración completa no está terminada.
