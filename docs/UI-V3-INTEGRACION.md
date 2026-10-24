# Renovación UI/UX V3 — integración de aprobaciones existentes

## Estado real

Implementados **localmente** sobre ae1a5652d4965cb7012fe32886c52ce8ac6a7220:
- Bloque 1: marco y controles compartidos.
- Bloque 2: Inicio, Agente general y Agenda.
- Bloques 3A–3H: listado/marco de ficha, Resumen, datos/edición/propiedad/WhatsApp, agente contextual, herramientas sectoriales, Documentos/RAG, Cronología y Checklist.
- Bloque 4A: Biblioteca general V2.
- Bloques 4B–4C: Carga V1.1 y Visor V1.
- Bloque 4D: Herramientas V1 y Modelos sectoriales V1 (`docs/UI-V3-BLOQUE4D.md`).
- Bloque 5: Alquileres V1.1 (listado/ficha/edición/índices), Nuevo contrato V1 y formularios de alta/edición de clientes V1 (`docs/UI-V3-BLOQUE5.md`).
- Bloque 6: Panel inmobiliario, Propiedades (lista/ficha/alta), listado de Clientes y Nueva operación (`docs/UI-V3-BLOQUE6.md`); composiciones y negocio conservados.

Cierre local preparado: remediación de dependencias, actualización de E2E y matriz autenticada por rubro/rol/pantalla. Ver `docs/UI-V3-CIERRE.md` para evidencias y límites.

**Auditoría del cierre:** cero vulnerabilidades reportadas en todas las dependencias tras actualizaciones dirigidas. Suite local: 1.328 pruebas / 98 archivos, tipos, lint y build aprobados. Estos resultados sustituyen únicamente el estado de auditoría anterior; el historial inferior conserva los resultados de cada corte.

**Pendiente de acreditación por SHA:** CI autenticada, RLS/drift, rollback y Preview lista/protegida. La publicación candidata en la rama no constituye aprobación del cierre ni habilita Production. Los checks anteriores no sustituyen los del nuevo acumulado. PR #26 permanece Draft hasta resolver todos los gates.

El usuario autorizó continuar en el repositorio y rama existentes `feat/anulus-shell-inmobiliaria`, con publicación final en su Preview protegida. Esta decisión específica sustituye para este trabajo la instrucción histórica de abrir otro paquete desde main. No autoriza merge ni Production.

## Fuente de verdad

- <mention url="https://app.notion.com/p/bd7421c3272b411b990829551dac9a73">Sistema visual V3</mention>
- <mention url="https://app.notion.com/p/044f799d231d451e8acf261821b40610">Inicio V1</mention>
- <mention url="https://app.notion.com/p/73df5c966d454c8f8997168ed017f1c3">Flechas y unificación</mention>
- <mention url="https://app.notion.com/p/8062f37870bc488d9199ee4a654856ba">Inventario/corrección de integración</mention>
- <mention url="https://app.notion.com/p/48262bd07ec64b9ab5aba858c7dfbec9">Cliente V2.1</mention>
- <mention url="https://app.notion.com/p/d929b31628364f9e8d619bdfa126b5a2">Resumen V2</mention>

Las muestras ya aprobadas no se rediseñan ni vuelven a pedir aprobación. Los encabezados “pendiente” de algunos ZIP pertenecen al momento original; las decisiones posteriores registradas prevalecen. No importar controles del laboratorio (rubro/escenario/guía) como funciones de producto.

## Bloque 1 — marco y primitivas

| Antes | Después | Por qué |
| --- | --- | --- |
| Marco oscuro y overrides `!important` globales | Frontera `data-visual-system="v3"`; reglas heredadas excluyen V3 | Evitar que el marco altere tablas y textos claros; no recolorear indiscriminadamente todos los descendientes. |
| Sidebar oscura, grupos no plegables y cuenta arriba | Sidebar clara, grupos plegables y cuenta inferior | Trasladar V3 preservando configuración, filtrado por rol/rubro, orden y destinos. |
| Menú móvil mediante details | Dialog nativo modal, Escape, foco devuelto y cierre al elegir destino | Patrón aprobado; foco contenido por el navegador. |
| Búsqueda grande, botón y cuenta compitiendo en cabecera | Contexto de espacio de trabajo y accesos compactos; cuenta en lateral | Conservar acciones reales, no añadir una guía ficticia de maquetas. |
| Primitivas con colores verdes/oscuros | AppButton, Surface, Typography, SelectField, WorkflowStepper y Tabs neutrales | Familias compartidas, sin cambiar consultas ni valores de formularios. |
| Selectores y flechas inconsistentes | CaretDown Phosphor 16px, inset derecho14px; selects nativos padding derecho44px e izquierdo14px | Criterio aprobado. `multiple`/`size` no intervenidos; fallback nativo en forced-colors. |
| Pestañas solo por clic | Misma selección/URL/montaje, foco y teclas de pestañas | Estilo aprobado, semántica tab/panel, preservar borradores y parámetros de URL. |

Marca provisional tomada de configuración existente. Ajustes y cerrar sesión mantienen enlace/formulario reales. No se añadieron acciones IA ni consultas nuevas. Se conservaron condiciones de visibilidad de acciones de cabecera; esta intervención no repara hallazgos de autorización del producto.

### Límites de este bloque

- ShellFrame se comparte entre aplicación y QA: no hay ruta ficticia agregada al producto.
- El QA renderiza Sidebar/Topbar reales con contexto simulado; no es sesión autenticada ni prueba RLS.
- El caso de cliente prueba ClientDetailMode/ReadView dentro del marco. Identidad, mensaje y formulario del fixture son representativos, no evidencia de toda la ruta real.
- Botones/campos propios de pantallas, MotionButton/FormSubmitButton, estados sectoriales y componentes de IA se trasladan/cotejan con sus pantallas; no se declara que todo consumidor sea V3 por cambiar las primitivas.
- La landing y autenticación no se migran de tema; opciones nativas oscuras permanecen fuera de V3.
- No cambios de dependencias, configuración de despliegue, variables, SQL, políticas, acciones servidor ni datos.

## Secuencia pendiente (no completada)

1. Inicio, Agente V1.2 y Agenda V1: trasladados localmente en bloque 2; pendientes de integración/validación final del conjunto y publicación.
2. Listados V1 y cabecera/controles de ficha: trasladados localmente en bloque 3A. Prioridad de Resumen V2 trasladada en 3B y datos/edición, propiedad y WhatsApp en 3C; agente contextual trasladado en 3D y herramientas sectoriales en 3E; Documentos V1.1 trasladado en 3F; Cronología V1 trasladada en 3G y Checklist V1.1 en 3H; pendiente validación integral autenticada del conjunto; no declarar la ficha completa migrada.
3. Biblioteca V2, Carga V1.1, Visor V1, Herramientas V1 y Modelos V1.
4. Alquileres V1.1, Nuevo contrato V1, Nuevo cliente V1 y acabado de Cliente V2.1.
5. Integración del lenguaje común con Panel inmobiliario, Propiedades (listado/ficha/alta), listado de Clientes y Nueva operación; conservar sus composiciones conformes, no inventar nuevas aprobaciones individuales.
6. Comparación de páginas completas y estados, contratos por rubro/rol, compuertas y publicación del conjunto en la misma rama/Preview.

Pruebas de aplicación con servicios reales y CI remota no se sustituyen por fixtures. No ejecutar seeds, escrituras de prueba ni migraciones contra la base actual.

## Validación local del bloque 1

- Suite unitaria: 921 pruebas aprobadas en 78 archivos (incluye 18 nuevas del marco).
- Typecheck, lint, build de producción y `git diff --check`: aprobados.
- Auditoría de dependencias de producción (`npm audit --omit=dev`): cero vulnerabilidades reportadas; no extiende esta afirmación a dependencias de desarrollo.
- Fixture local con componentes reales, contexto simulado y sin servicios: 323 comprobaciones aprobadas, cinco anchos (320/390/768/1024/1440) y cinco escenarios (controles, cliente, auditor, legal, notarial).
- Comprobaciones adicionales: 22 aprobadas (teclado/formulario, foco, colores forzados, movimiento reducido, selector nativo, pares de contraste muestreados y menú en pantalla corta). No constituye certificación WCAG ni prueba autenticada.
- Se conservan advertencias previas de las herramientas de pruebas; no se declara salida sin advertencias.
- Sin commit, push ni despliegue de este bloque; sin cambios en la base actual.

## Bloque 3D — agente contextual integrado localmente
Ver `UI-V3-BLOQUE3D.md`: conversación, memoria, propuestas y compositor con presentación aprobada y contratos conservados. 17 pruebas nuevas, suite 1049/85. Sin despliegue; faltan herramientas sectoriales y restantes pestañas. Auditoría actual: 2 paquetes críticos preexistentes, dependencias intactas, remediación pendiente antes de publicar.

## Bloque 3E — herramientas sectoriales integradas localmente
Ver `UI-V3-BLOQUE3E.md`: presentación aprobada de herramientas por rubro, resultados y formularios originales conservados. 44 pruebas nuevas; suite acumulada 1093/86. Matriz local 1385 comprobaciones/90 recorridos; 29 comparaciones exactas de preservación. Sin publicación ni cambios en la base. Restan Documentos, Cronología, Checklist y demás pantallas. Auditoría actual: 2 paquetes críticos (Next.js/DOMPurify), dependencias intactas; remediación pendiente antes de publicar.

## Bloque 3F — Documentos V1.1 integrado localmente
Ver `UI-V3-BLOQUE3F.md`: lista prioritaria y consulta plegable debajo, fuentes internas, aportes/notas, controles por helpers de rol y confirmación humana dentro de la página. Actions, consultas y payloads intactos. 34 pruebas nuevas; suite 1127/87. Matriz 2922 comprobaciones/105 recorridos; 12 comparaciones exactas. Sin publicación ni escrituras en base. FD-02/FD-03 y las 2 vulnerabilidades críticas de dependencias siguen pendientes. Próximo: Cronología y Checklist.

## Bloque 3G — Cronología V1 integrada localmente
Ver `UI-V3-BLOQUE3G.md`: secuencia única, orígenes, filtro local, alta manual y confirmación de eliminación, catálogos/actions originales y registros manuales inválidos conservados. 34 pruebas nuevas; suite 1161/88. Matriz 2475 comprobaciones/105 recorridos; 13 comparaciones exactas. Sin publicación ni escrituras en base. Para cerrar ficha queda Checklist; para el conjunto quedan 6 bloques grandes de planificación (no seis pantallas/entregas). FC-02/FC-03 y seguridad de dependencias pendientes.

## Bloque 3H — Checklist V1.1 integrado localmente
Ver `UI-V3-BLOQUE3H.md`: progreso y lista única, indicadores V1.1 estáticos, gestión plegable, alta y confirmaciones conservando acciones/payloads. Helpers de rol alinean controles manuales. 38 pruebas nuevas y 16 comparaciones exactas. Cuatro pestañas trasladadas localmente, no ficha autenticada completa ni lista para publicar. **AutoMatchTrigger y su montaje originales se conservan: FCK-01 no reparado y fixture sin ese efecto.** FCK-02 y seguridad pendientes. Quedan 5 bloques grandes para el conjunto; próximo Biblioteca/Carga/Visor. Sin publicación ni escrituras reales.

Validación de cierre 3H: suite 1199/89, 5750 comprobaciones/135 recorridos, 16 comparaciones exactas, 12 capturas; typecheck/lint/build/diff aprobados. Auditoría mantiene 2 paquetes críticos Next.js/DOMPurify, sin cambios de dependencias.

## Bloque 4A — Biblioteca V2 integrada localmente
Ver `UI-V3-BLOQUE4A.md`: colección/contexto, selección separada del visor, búsqueda GET, foco móvil, controles por rol y confirmación de borrado conservando acciones originales. Errores de lectura y análisis desconocido explícitos; sin falsos vacíos. 23 pruebas nuevas, suite 1222/90; matriz 3837 comprobaciones/135 recorridos, 15 comparaciones exactas y 15 capturas. Typecheck/lint/build/diff aprobados. BIB-01 parcial de presentación; BIB-03/BIB-04 y seguridad pendientes. Carga V1.1 y Visor V1 siguen pendientes; primer grupo parcial, quedan 5 bloques grandes. Sin publicación ni cambios en la base.

## Bloques 4B–4C — Carga V1.1 y Visor V1 trasladados conjuntamente
Ver `UI-V3-BLOQUE4BC.md`: formulario/cola/resultado con selectores aprobados; visor primero, panel Detalles/Análisis y acciones administrativas separadas. Acciones servidor originales, concurrencia 3, URL firmada 5min, auditoría de vista, análisis e historial conservados. 37 pruebas nuevas y 117 cotejos (incluye 98 hashes acumulados). FU-01 y FU-02 con mejora visual local; FU-03 pendiente. VD-01 retira score de la presentación, no cambia algoritmo interno de recomendaciones; VD-02 distingue URL faltante de formato no compatible. PDF usa controles nativos reales, no simulación del HTML. Biblioteca/Carga/Visor trasladados localmente: quedan 4 bloques grandes para conjunto. Validación E2E/seguridad/publicación pendientes; Preview anterior sin actualizar.

Cierre 4B–4C: suite final 1259/93 aprobada; typecheck/lint/build/diff aprobados, 4785 comprobaciones/210 recorridos, 117 cotejos y 18 capturas. Un intento intermedio tuvo fallo de espera en test no modificado de Propiedades con Chromium en paralelo; repetición completa sin competencia aprobada. Logs históricos conservados. Respaldo acumulado 112 archivos con parche/hashes verificados. Próxima entrega agrupada: Herramientas y Modelos.
