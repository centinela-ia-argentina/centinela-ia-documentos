# Bloque 3D — interior del agente contextual

## Alcance y estado
Integración **local y parcial**, sobre la misma base de los bloques 1, 2 y 3A–3C. Destino previsto: `feat/anulus-shell-inmobiliaria`. Sin commit/push/deploy de este conjunto; no main/merge/Production, ni escrituras en base actual. No se presenta la ficha completa como terminada. Las herramientas sectoriales y restantes pestañas son tramos pendientes.

Referencia aprobada: Resumen operación V2 (Notion d929b31628364f9e8d619bdfa126b5a2), asistencia contextual dentro del disclosure, conversación neutral y confirmación humana. No nueva dirección visual ni pedido de aprobación repetido.

## Implementación
- `AgenteChat.tsx`: encabezado/contexto, mensajes de usuario y agente, sugerencias, memoria, propuestas, descarte/deshacer, éxito/reintento/error y compositor etiquetado. Phosphor en controles y propuestas; estados textuales de memoria y saludo conservados. Se retiran brillo, degradados y pulsos de las tarjetas antiguas.
- `ContextAgent.module.css`: estilos propios, superficies claras y textos neutros, botón de envío de mínimo 112 × 44 px, texto largo sin desbordamiento, foco visible, composición móvil apilada. Color semántico acompañado de texto, no utilizado como único indicador.
- `CaseAgentDisclosure`: solo cambia la clase del cuerpo a `agentBodyV3`; apertura diferida, foco, permisos y montaje conservado al cerrar siguen idénticos. Aislamiento del CSS adaptador legado con `:where()` sin elevar especificidad de otros controles.
- El saludo sigue usando `MaquinaEscribir` compartido y su velocidad original. No se cambió globalmente. En movimiento reducido se suprime el parpadeo visual, pero **el temporizador de tipeo sigue existiendo**. No se afirma ausencia total de temporizadores/animación de texto.

## Contratos preservados
Comparación automática: tipos de props, estado, efectos y handlers del componente byteidénticos; metadatos de las 18 acciones y helper de fecha idénticos. Actions server y motor IA intactos respecto de la base; dependencias intactas. El diagnóstico permanece al activar el agente, no al cargar la ficha. Consultar y aprobar acciones siguen siendo operaciones distintas.

Se conservan: consulta recortada e historial sin propuestas; sugerencias que envían directamente; Enter/Shift+Enter; bloqueo de envío duplicado pendiente; historial, advertencia no bloqueante y cierre de aviso; confirmación nativa para borrar; aprobación, descarte, deshacer, reintento y éxito; enlace de modelos en pestaña aislada sin ejecutar acción server. React sigue escapando texto y el parser de negritas/listas no incorpora HTML interpretado.

El distintivo «En línea» preexistente no es una comprobación nueva de conectividad. No se modificaron las reglas de autorización ni se declara corregido un hallazgo de seguridad de negocio.

## Validación
- 17 pruebas nuevas de agente; suite acumulada: **1049 pruebas / 85 archivos**.
- Typecheck, lint, build y `git diff --check`: validados al cierre del bloque.
- Matriz Chromium local: 3 rubros × 3 escenarios (historial, vacío y texto largo) × 5 anchos (320, 390, 768, 1024 y 1440). **495 comprobaciones / 45 recorridos**, sin fallos, errores de página ni solicitudes HTTP externas; ver `browser.json`.
- Componentes reales dentro del marco real; contexto, datos y respuestas simulados. Servicios externos bloqueados, sin DB ni IA real. Aprobación probada contra un stub, no ejecutada en la base actual. No equivale a E2E autenticado, RLS, CI ni Vercel.
- Capturas de detalle muestran el agente real integrado con datos ficticios; las fixtures incluyen herramientas/pestañas de ensayo, no una ficha completa.
- Incidencias de preparación: formato `.test.tsx` no incluido por Vitest (adaptado a `.test.ts`), tipos de mocks/props ajustados; selector del disclosure dependía de texto oculto en móvil (reemplazado por su nombre visible estable). Un primer aislamiento CSS aumentaba especificidad y fue reemplazado por `:where()`. Las capturas de página completa con scroll/foco pueden mostrar elementos fijos desplazados; las capturas finales de detalle usan un viewport alto para encuadrar el componente sin superponer la barra fija y no se utilizan como evidencia de un marco nuevo. No se relajaron las aserciones de comportamiento.
- Advertencias del entorno de pruebas: Vite CJS, atributo JSX del tipeador compartido y actualizaciones asíncronas sin `act` en algunos ensayos; no fallos de la suite.

## Compuerta de publicación
La auditoría actual sigue informando **2 paquetes críticos: Next.js y DOMPurify**. Archivos de dependencias intactos. No `audit fix` ni actualización silenciosa. Remediación/revisión pendiente antes de publicar; reportes históricos de cero no representan este estado. El conjunto continúa local, sin afirmar que el preview remoto ya contiene estos cambios.
