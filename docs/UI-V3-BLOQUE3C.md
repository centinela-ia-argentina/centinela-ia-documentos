# Bloque 3C — datos, edición, propiedad y WhatsApp del Resumen

## Estado real

Traslado local de los datos y la edición de la ficha, propiedad vinculada y WhatsApp de operación. Se integra sobre los bloques 1, 2, 3A y 3B, sin rediseñar lo aprobado. **El Resumen completo aún no está terminado:** interior del agente contextual y herramientas sectoriales pendientes. No commit, push ni nuevo deployment; destino previsto `feat/anulus-shell-inmobiliaria`, misma base `ae1a5652d4965cb7012fe32886c52ce8ac6a7220`.

Referencias: <mention url="https://app.notion.com/p/d929b31628364f9e8d619bdfa126b5a2">Resumen V2 aprobado</mention>, <mention url="https://app.notion.com/p/a31fc9fa6de549f9b32ad7827fae75a6">Ficha y datos</mention> y <mention url="https://app.notion.com/p/73df5c966d454c8f8997168ed017f1c3">Controles y flechas</mention>. Los rótulos históricos “pendiente” de los ensayos no revocan las aprobaciones posteriores; tampoco convierten sus botones explicativos en acciones de producto.

## Implementado

- `CaseFacts`: lectura compacta con `dl`, etiquetas discretas, valores y vencimiento semántico. Una columna en escritorio y dos en móvil. Los campos visibles llegan de la ruta, con el mismo orden y filtro; moneda vacía continúa mostrando “Sin definir” cuando corresponde. No se agregan metadatos ficticios al producto.
- Edición nativa dentro de `details`, conservando apertura inicial y montaje del formulario: **no** se reemplazó por un modal ni se desmonta el borrador al plegar. Labels asociados a controles, caret Phosphor de 16 px, foco visible, campos y botón de 44 px. Selectores nativos usan la flecha/insets aprobados (16 px, derecha14, padding44/14) y fallback nativo en colores forzados.
- `LinkedProperty`: lectura, dirección/fallback, estado/tipo y enlace a ficha. Mismo formulario de vincular/desvincular, catálogo y orden recibidos, misma condición `canUpdateCase(profile.role)`. `RecordPendingButton` conserva el contrato Guardando/deshabilitado de `FormSubmitButton`, sin modificar ese componente global.
- `WhatsAppIntentBuilder`: variante visual optativa `appearance="record"`, usada solamente por la ficha de operación. Controles neutros e iconos Phosphor, plantilla editable y aviso de revisión. Generar, editar, copiar y abrir mantienen estado/handlers idénticos. No se genera ni registra ni abre nada al montar. Copiar registra el evento existente; abrir usa el mismo enlace y evento. La variante compacta y el estilo predeterminado de otros consumidores se conservan.
- `CaseSummaryLayout`: los datos nuevos tienen un contenedor propio `factsV3`, fuera de los antiguos adaptadores de cards/grillas. Se acotó el adaptador heredado de fondos de campos a sus áreas antiguas: antes anulaba el SVG de los selects nuevos. No se solucionó con otro `!important` general.

## Contratos conservados y límites

Comparación contra la copia previa de este tramo:

- Autenticación, consultas Supabase, derivaciones, estados, campos y visibilidad de metadatos de la ruta idénticos.
- Cabecera/tabs previas a los datos y **todo** el contenido posterior a los datos idénticos: prioridad, agente, herramientas y las otras pestañas no se alteraron.
- Mismas acciones `updateCaseStatus` y `vincularPropiedadOperacion`, mismos nombres `case_id`, `status`, `case_metadata.<key>` y `property_id`; mismos valores y opciones por rubro. No se agrega edición de título ni cliente. El estado fuera de catálogo continúa siendo añadido por la ruta, sin traducir su valor persistido.
- Misma condición inmobiliaria y permiso de propiedad. No se añadió una guarda de rol nueva a la edición de datos: su visibilidad preexistente se conserva; esto no constituye reparación de hallazgos de autorización ni validación de permisos del servidor.
- `phone`, contexto `operation`, recurso y `generateOperationMessage(caseRecord)` intactos en la ruta; estado y todos los handlers de WhatsApp idénticos byte a byte frente a la copia previa.
- Sin cambios en acciones servidor, esquema, SQL/RLS, variables, dependencias, configuración de deploy, datos ni políticas. `package.json` y lockfile coinciden con la base.

## Validación local

- **1.032 pruebas unitarias aprobadas en 84 archivos**, 32 nuevas del tramo. Pruebas de contratos para tres rubros, campos/opciones/defaults, apertura vacía, estado histórico, borradores, payload explícito, roles de propiedad, desvinculación, pendiente y WhatsApp.
- **3.058 comprobaciones visuales aprobadas**, 18 escenarios × cinco anchos (320, 390, 768, 1024, 1440), 90 ejecuciones. Cero fallas, errores de página o solicitudes HTTP. Incluyen edición por teclado, foco/caret, campos de 44 px, fallback de colores forzados, borrador al plegar y cambiar de tab, payload de envío, propiedad por rol y WhatsApp explícito.
- Typecheck, lint, build y `git diff --check` aprobados.
- Fixtures con componentes de producción de datos/edición, propiedad, WhatsApp, prioridad, shell, cabecera y tabs; contexto y acciones simulados. Herramientas son un marcador explícito y solo hay dos paneles de ensayo: no es prueba de la ficha completa ni de sus pestañas pendientes. Clipboard y apertura externa interceptados; no se enviaron mensajes ni se abrió WhatsApp real.
- No QA autenticado, escrituras en la base, RLS, CI remota ni Vercel. No certificación WCAG. Advertencias preexistentes Vite CJS y atributo `jsx` en jsdom conservadas.
- Incidencias resueltas: tipo del `case_type` corregido a nullable para conservar el contrato; prueba visual detectó que un `background` heredado borraba la flecha nativa. Se acotó el estilo y agregó regresión; registro de la primera ronda preservado. La suite final pasa sin cambiar contratos para hacer pasar la prueba.

## Seguridad y publicación

La auditoría actual `npm audit --omit=dev` mantiene **2 paquetes con severidad crítica: Next.js y DOMPurify**, con múltiples avisos. No se actualizaron dependencias ni se ejecutó `audit fix`. Coinciden con las dependencias de la base; no es prueba de explotación. Los informes cero anteriores son históricos, no el estado actual.

Paquete todavía incompleto y revisión de dependencias pendiente: **no aprobado para deployment**. Antes de publicar la Preview protegida de la misma rama, revisar/remediar compatiblemente esas alertas y validar el conjunto. Sin main/merge/Production ni modificaciones de la base actual.

## Siguiente tramo

Interior del agente contextual y herramientas reales del Resumen V2 (acciones, resultados, compatibilidades y guardas existentes), luego Documentos V1.1, Cronología V1 y Checklist V1.1. Continuar el inventario aprobado, sin volver a diseñar ni pedir la misma aprobación.
