# Bloque 3G — Cronología V1 integrada localmente

## Alcance
Continuidad del repositorio y destino `feat/anulus-shell-inmobiliaria`, base ae1a5652d4965cb7012fe32886c52ce8ac6a7220. Referencia aprobada: Ficha-cronologia-V1.html (Notion ae5a0f79b3c44229a2926189530df41f). Sin rediseño ni nueva aprobación. Implementación LOCAL, sin commit, push, deploy, main ni Production.

## Traslado
- Una secuencia cronológica con fecha, origen, título, detalle e indicador futuro recibido. Se elimina la segunda lista manual redundante. Filtro por origen exclusivamente de presentación, sin consultas ni mutaciones nuevas; ayuda lateral pasa debajo en pantallas estrechas.
- Se conserva íntegra la construcción de fuentes, deduplicación, orden y fechas del servidor; solo se añade eventId a los hitos manuales para vincular su control de eliminación. Datos del registro se nombran por rubro en presentación, sin cambiar metadatos.
- Alta manual en diálogo nativo con los cuatro campos originales: eventDate, eventType, title y description. Catálogos originales: 8 tipos inmobiliarios y 13 compartidos legal/escribanía, sin inventar un catálogo notarial. Payload y acciones originales conservados.
- Eliminación solo en registros manuales con ID, mediante confirmación explícita. Foco inicial Cancelar, Escape y retorno al disparador. Alta enfoca fecha; cierre/reapertura conserva borrador. canUpdateCase existente controla edición visible por rol; servidor/RLS no se modifican.
- Registros manuales con fecha inválida que antes aparecían en la lista secundaria se conservan en una sección separada «Registros manuales sin fecha válida». No se pierden al quitar la duplicación; no se mezclan en el orden ni en el recuento de hitos válidos.
- CSS neutral acotado, iconos Phosphor, carets centrados, controles de 44 px, texto largo ajustable, foco y colores forzados. Formularios conservan flujo vertical en móvil; no se afirma réplica píxel por píxel del HTML.

## Contratos y límites
13 comparaciones exactas aprobadas: construcción del servidor salvo el enlace ID manual; Resumen/Documentos; Checklist y sufijo; ambos catálogos; payload de alta; actions, helpers de roles/fechas/deduplicación y dependencias.
Sin DB, Storage, IA, correos ni escrituras reales. Acciones del fixture simuladas: no prueba autenticada/RLS/CI/Vercel. Sin filas optimistas ni toast de éxito inventado; el diálogo permanece abierto tras submit, y no se modifica el contrato previo sin resultado explícito de éxito/fallo. El estado pendiente prueba la espera del action, no confirma una escritura.
FC-01: copia de origen por rubro atendida solo en UI; catálogo compartido conservado. FC-02: cálculo esFuturo con día UTC permanece, no se corrige silenciosamente. FC-03: deleteCaseEvent filtra ID y organización, no case_id; permanece para revisión separada, sin declarar vulnerabilidad confirmada o reparada. Comprobación de errores de inserción/resultados servidor no reparada en esta migración visual.

## Validación
- 34 pruebas nuevas; suite completa: 1161 pruebas en 88 archivos.
- Typecheck, lint, build de producción y git diff --check aprobados al cierre. Primer typecheck detectó una opción `exact` no admitida por Testing Library; retirada del test (string sigue siendo exacto por defecto), foco y suite repetidos. No cambio de contrato para satisfacer el ensayo.
- Chromium local: 2475 comprobaciones / 105 recorridos (3 rubros × 7 escenarios × 5 anchos 320/390/768/1024/1440), sin fallos, errores de página ni solicitudes HTTP externas. Permisos, orden, filtros, catálogos, campos/payload, borrador, pendiente, cancelación, foco y confirmación manual verificados con stubs.
- 8 capturas de componentes reales: cronología en tres rubros a 390/1440, alta y confirmación móviles. Regiones/componentes, no certificación de ficha completa ni de navegación remota. Otras pestañas de ensayo explícitamente parciales.
- Auditoría producción: 2 paquetes críticos (Next.js y DOMPurify); dependencias intactas, remediación pendiente antes de publicar. Advertencias históricas de herramientas no equivalen a salida sin advertencias.

## Pendiente
Para cerrar la ficha actual queda Checklist V1.1. Para el conjunto se agrupan 6 bloques grandes: Checklist; Biblioteca/Carga/Visor; Herramientas/Modelos; Alquileres/Nuevo contrato/Nuevo cliente/acabado Cliente; Panel/Propiedades/listado Clientes/Nueva operación; validación completa/seguridad/publicación. No son seis pantallas ni seis entregas obligatorias. Todo lo ya aprobado se traslada, no se rediseña. La Preview remota vieja aún no contiene la integración local.
