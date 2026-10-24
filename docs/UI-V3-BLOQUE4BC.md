# Bloques 4B–4C — Carga V1.1 y Visor V1

## Estado y alcance
Entrega conjunta local en el repositorio existente, acumulada sobre 4A. Traslado de versiones ya aprobadas, sin rediseño ni nueva ronda de aprobación. Las leyendas «pendiente de revisión» de los paquetes HTML son históricas; no reemplazan la autorización posterior del usuario para integrar esas versiones.

Fuentes: Carga-documentos-V1.1.html, carga.css, selectores.css y REVISION.md/REVISION-V1-historico.md de Carga V1.1; Visor-documental-V1.html, visor.css, REVISION.md y contenido-visor.html de Visor V1. No se incorporan laboratorios, simuladores ni datos ficticios a rutas de producto.

## Carga V1.1
- Página dedicada con retorno a Documentos de la ficha o Biblioteca, destino preseleccionado opcional, datos comunes del lote y guía lateral discreta. Formulario/cola/resultados separados.
- Selectores nativos, una flecha centrada, inset derecho 14px, reserva de texto 44px. Forced-colors recupera flecha nativa. No menú custom ni cambios del calendario nativo.
- Cola con nombre completo adaptable, tamaño, texto/icono de Preparado/En curso/Cargado/Duplicado/Error, quitar de selección y reintento. Eliminar de la cola no borra de la Bóveda.
- FU-01: rechazos locales MIME/tamaño muestran nombre y motivo; reglas originales de cinco MIME y 50×1024×1024 bytes intactas. No es validación del contenido ni reparación de servidor.
- FU-02: compuerta visual de la página usa isUserRole/canUploadDocument, sin formulario de carga para lectura. Acción servidor y consultas originales intactas; no es auditoría RLS/autorización integral.
- FU-03 sigue pendiente: reintentos usan los metadatos actuales tras resultados parciales. Se aclara en el formulario, no se bloquea ni migra información silenciosamente.
- retryUpload y handleSubmit originales preservados: FormData file/case_id/document_type/sensitivity_level/expires_at, máximo tres tareas concurrentes, omisión de éxitos, duplicados y resultados del servidor. Sin redirección automática; continuar es decisión explícita.
- Excepciones absorbidas por el worker del submit original y resultados no atómicos del backend no se reparan aquí. La integración no promete recuperación de red ni un resultado mejor que el contrato actual.

## Visor V1
- Archivo como superficie principal; Detalles/Análisis en panel lateral con navegación por teclado. Abrir original/Descargar visibles; archivo/restauración y borrado en control secundario por rol. Confirmación nativa humana para borrado, Cancelar enfocado, Escape y retorno de foco; sin confirmación doble.
- PDF usa iframe y controles nativos reales del navegador para páginas/zoom. No se importan los controles simulados de la maqueta ni se inventa cantidad de páginas; su aspecto depende del navegador. JPG/PNG se muestran sin optimización externa y ajustados al ancho. XLSX/otros formatos no reciben un visor fabricado.
- VD-01: se retira la presentación de riesgo/puntuación y dictamen derivados de sensibilidad, incluso con análisis. La sensibilidad manual permanece separada; no se fabrica una evaluación profesional. getRiskAssessment interno sigue intacto como dependencia de recomendaciones de acceso; no es reemplazo del algoritmo ni auditoría de su validez.
- VD-02: falta de URL temporal se distingue de formato no previsualizable; acciones de abrir/descargar deshabilitadas si falta URL. No se modifica Storage ni se agrega renovación automática. URL firmada sigue a 5min.
- Descargar usa el mismo enlace temporal con atributo download; la disposición final depende de las cabeceras de Storage y del navegador. No se afirma descarga forzada cross-origin ni se introduce un proxy sin autorización.
- Estado IA desconocido si falla su lectura, sin presentarlo como ausencia de análisis ni ofrecer reanálisis sobre esa presunción. Mensajes de resultado/error heredados conservados.
- Último análisis, versiones anteriores, plazos filtrados con esPlazoAccionable, poder/estatuto notarial, sugerencias de Modelos y texto parcial conservados. Enlace #poder abre Análisis; no ejecuta acciones. Orientaciones de checklist/faltantes/acceso se mantienen como sugerencias de control manual, no marcadas como revisión realizada.
- Pantalla de error de ruta conserva reset y retorno, con contraste del marco claro. E-LINK-TITLE-01 («untitled» del visor nativo) no reparado.

## Preservación y seguridad
117 cotejos aprobados: 19 comparaciones de contratos/archivos base y 98 SHA256 del acumulado anterior. Se excluyen del cotejo anterior el documento de integración que se actualiza y un test de Biblioteca que ahora espera el final de la transición, no solo la invocación de la acción. Código de Biblioteca intacto.

Acciones servidor, dependencias, helpers de permisos/tipos/vencimiento y componentes de poder/plazos intactos. Se preserva createAuditLog(document_viewed) de la ruta real: abrir el documento autenticado sí registra una vista; fixtures/tests lo simulan, nunca lo llaman contra servicios reales. Carga servidor conserva auto-matching original; FCK-01 de ficha sigue pendiente. No afirmar que la aplicación real no tiene escrituras automáticas por haber usado fixtures sin servicios.

Última auditoría de producción disponible: 2 paquetes críticos Next.js/DOMPurify, dependencias intactas. Remediación pendiente antes de publicar; sin audit fix indiscriminado. BIB-03 y hallazgos históricos no se dan por reparados.

## Evidencia local
37 pruebas nuevas: Carga (12), compositor Visor (15), composición de ruta real con servicios simulados (10). Fixtures de componentes reales sin sesión/servicios: tres rubros, siete escenarios por superficie y cinco anchos; PDF e imagen ficticios locales. No prueban Storage, cookies, RLS o backend real. 18 capturas; inspección directa de carga escritorio, resultado parcial móvil, visor PDF escritorio y error URL móvil; no se afirma inspección directa de todas.

Incidencias registradas: tipos iniciales corregidos (archived_at real y dependencia de helper interno), advertencia Image resuelta sin servicio de optimización, espacios de JSX eliminados. Primer recorrido de navegador no inició por ruta local errónea de Playwright, corregida sin instalación. La suite inicial detectó espera prematura en un test de Biblioteca: ahora espera el final de la transición. Logs iniciales conservados separados, no presentados como aprobados.

La validación del conjunto y sus cifras finales se consignan en el manifiesto del respaldo y registro de integración. Sin commit, push, despliegue, cambios de entorno/SQL/main/Production ni acceso de pruebas a base, Storage o IA. El Preview publicado sigue siendo anterior.

## Continuidad
Biblioteca/Carga/Visor trasladados localmente, no E2E autenticado final ni conjunto listo para publicar. Restan 4 bloques grandes: Herramientas/Modelos; Alquileres/contrato/formularios de clientes; pantallas restantes (Panel, Propiedades, Clientes, Nueva operación); validación integral, seguridad y publicación protegida. No son cuatro pantallas ni cuatro entregas de duración fija.

## Cierre de validación
- Suite final: **1259 pruebas aprobadas en 93 archivos**, incluidas las 37 nuevas. Typecheck, lint, build y git diff --check aprobados.
- Matriz final: **4785 comprobaciones, 210 recorridos**, sin fallos, errores de página ni solicitudes externas. 18 capturas y comprobación adicional de enlace notarial sin mutación. Cotejo de preservación: 117 aprobados (98 hashes acumulados y 19 comparaciones).
- Una corrida completa intermedia falló por la espera de un test de PropertyWorkspace bajo ejecución paralela con Chromium. Producto y test de Propiedades no se modificaron; suite final completa repetida sin esa carga paralela aprobada. Se retienen ambos logs, sin declarar que todos los intentos pasaron.
- El respaldo acumulado incluye 112 archivos, originales, parche aplicado en copia limpia y verificación SHA256 de todos los archivos. Sigue siendo integración local parcial, no autorización para publicar ni validación de servicios reales.
