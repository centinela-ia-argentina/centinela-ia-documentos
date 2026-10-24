# Bloque 6 — Panel, Propiedades, listado de Clientes y Nueva operación

## Alcance y estado

Traslado local al lenguaje común V3 de composiciones conformes existentes; no nuevo rediseño ni solicitud de aprobación. Base `ae1a5652d4965cb7012fe32886c52ce8ac6a7220`, rama destino `feat/anulus-shell-inmobiliaria`, worktree detached. Sin commit, push, merge, Preview nueva ni Production. Sin cambios de dependencias, SQL, variables, base de datos, Storage o IA reales.

- Panel inmobiliario (`/copiloto`): paleta, tipografía y controles comunes; mismos cuatro indicadores, consultas, alcance organizacional, cálculo de ajustes y enlaces. Abrir asistente no ejecuta IA; resumen y consultas solo por solicitud. Se preservan tabs, teclado, errores, borradores y vista de auditor.
- Propiedades: listado, consulta de ficha y alta con superficies claras, estados semánticos, foco visible y textos largos contenidos. No se alteraron consultas, filtros, catálogos, precios ni enlaces de tarjetas.
- Ficha: conserva Ficha/Comercial/Tasación y comparables/Vínculos, montaje de paneles, edición explícita y descarte confirmado, publicación asistida manual, comparables, matching y lectura documental. Los resultados opcionales de aviso/tasación/matching tienen una frontera visual local; callbacks y payloads idénticos. Modal de comparable legible, sin cambiar su foco, validación ni guardado.
- Alta de propiedad: mismos diecisiete campos, nombre obligatorio, catálogos, defaults, validación y cancelación por cambios sin guardar. Crear no publica ni envía mensajes.
- Clientes: listado integrado visualmente, sin alterar criterios, presupuesto, datos de contacto, roles, consultas ni matching. Formularios del bloque 5 intactos.
- Nueva operación: mantiene los tres pasos y su composición, campos visibles/ocultos, navegación, foco, borradores y payload único por nombre. Solo estilos locales y clases de presentación; no cambios al alta en servidor. Altas de Jurídico/Escribanía conservadas, no reemplazadas por wizard inmobiliario. Círculos de paso con ancho estable también en móvil.

## Validación

Fixture local de 80 combinaciones disponibles que monta rutas/componentes reales con ShellFrame/Sidebar/Topbar, datos ficticios y servicios simulados. La matriz ejecutada cubre **58 escenarios y 170 aserciones**: anchos 320/390/768/1024/1440; admin/auditor; vacíos, errores, reservados, textos largos; altas de otros rubros; acciones explícitas, payloads, borradores, tabs por teclado, cancelación de descarte, IA y modal de comparables. Sin fallos, errores JS ni solicitudes externas. No equivale a autenticación real, RLS ni persistencia.

Se añadieron **17 tests**: nueve de resultados opcionales de IA (no llamada al montar, identificador conservado, error y cierre sin otra consulta) y ocho de fronteras visuales/foco/pasos. Los tests funcionales existentes siguen verificando formularios, permisos, queries y payloads.

Suite acumulada: **1328 tests en 98 archivos, todos aprobados**. Typecheck, lint y build aprobados.

**163 controles de preservación**: 146 hashes del bloque 5 fuera de la documentación de estado; dieciséis fuentes exactas o AST equivalente excluyendo únicamente clases visuales, import CSS e inicializador de `inputClass`; una frontera visual local. Incluye páginas servidor, tarjetas, workspace y formularios sin cambios; los cuatro componentes con cambios TSX conservan estructura de negocio. Respaldo acumulado aplica el patch sobre una copia limpia y verifica todos los hashes.

Las pasadas iniciales detectaron selectores de QA incorrectos/ambiguos y que las altas de otros rubros tienen h2, no h1; se corrigió el fixture, no se modificaron esos flujos. La revisión visual detectó círculos de pasos comprimidos en móvil y resultados IA heredados poco legibles; corregidos localmente antes de la pasada final. No se suprimieron errores del navegador.

## Límites pendientes

- PR01: el listado de propiedades conserva la consulta que ignora errores y puede mostrar un vacío indistinguible. No se afirma reparado.
- CL02: el listado/matching sigue usando `zone`; la discrepancia con geografía de formularios no se resolvió con fallbacks inventados.
- La alta de operaciones conserva sus controles existentes; no se presenta como reparación de autorización. Lectura/acciones de servidor y políticas RLS requieren validación autenticada.
- Controles nativos de fechas, exportación PDF, enlaces externos y proveedores no se certifican mediante los mocks. No se enviaron mensajes ni publicaciones ni solicitudes reales de IA.
- Continúan los hallazgos funcionales ya declarados de bloques anteriores; este bloque es integración visual, no cambio encubierto de reglas de negocio.
- Última auditoría disponible: alertas críticas de Next.js y DOMPurify. Dependencias sin modificar; remediar y auditar antes de publicar.

## Un último grupo de cierre

Validación integral autenticada por rubro/rol/estado, revisión transversal de pantallas y regresiones, resolución de bloqueantes de seguridad y publicación del conjunto en Preview protegida de la misma rama. Sin merge ni Production. Es un grupo de alcance, no una promesa de duración o de un solo turno. La integración local de estas pantallas no certifica que la aplicación completa esté lista para publicar.
