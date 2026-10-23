# Bloque 4D — Herramientas V1 + Modelos sectoriales V1

## Estado real
Integración conjunta local de versiones ya aprobadas, sin rediseño ni nueva solicitud de aprobación. Destino acordado `feat/anulus-shell-inmobiliaria`; worktree aún detached en `ae1a5652d4965cb7012fe32886c52ce8ac6a7220`. No commit, push, merge ni despliegue. PR26/Preview remotos no contienen estos cambios.

Antes de continuar se detectó retroceso del entorno a 3D (68 archivos). Se recuperaron 112 archivos del respaldo acumulado 4ABC: base y 68 hashes previos coincidentes, ningún cambio ajeno y 112 hashes restaurados verificados. Evidencia `recovery-4abc.json`. No reset de otras ramas/worktrees.

## Herramientas V1
Fuentes aprobadas: Herramientas-documentales-V1.html, contenido-herramientas.html, herramientas.css y REVISION.md. Catálogo persistente Archivos/Texto y un espacio de trabajo activo. Cinco componentes reales permanecen montados al cambiar de herramienta; la selección de archivos y el subestado se conservan entre herramientas, no entre rutas ni al recargar.

Se mantienen los procesadores reales de imágenes/PDF/texto, límites y payloads. Guardar en Documentos sigue siendo una acción explícita de carga; HT-01: controles y handler guardados con canUploadDocument, sin sustituir la autorización servidor. Se conserva el procesamiento local y se aclara que PDF.js puede descargar su worker externo (HT-02); no se afirma modo completamente offline. No se agregan límites de imagen/memoria (HT-03 pendiente). Entradas de archivos accesibles al teclado; indicadores de selección textuales/semánticos.

## Modelos sectoriales V1
Fuentes aprobadas: Modelos-sectoriales-V1.html, contenido-modelos.html, modelos.css y REVISION.md. Catálogo con búsqueda/filtro permanece al seleccionar. Pasos explícitos Completar datos → Revisar borrador, paneles conservados y teclado en pestañas. Faltantes siguen señalados con placeholders; pasar a vista previa no equivale a validación. Campos en dos columnas en escritorio y una en móvil. Revisión de escrito propio con IA separada y plegada inicialmente; no se ejecuta por abrir el panel.

Conservados: aislamiento de rubro, bloqueo client en ruta, auditor sin IA, bloqueo productivo de modelos obsoletos/retirados, metadatos/fuentes/advertencias de revisión, prellenado inicial y manual con protección de respuestas obsoletas, redacción IA y retorno manual, Copiar/TXT/DOCX. El prellenado de la ruta real puede invocar la acción IA original al abrir con modelo/expediente iniciales y permiso: no se elimina ni se presenta como ausencia de efectos automáticos.

MD-01: jurisdicción sigue inferida del título, sin reparación silenciosa. MD-02: DOCX conserva falta de pending/error propio. MD-03: fallo de portapapeles no tiene feedback de error nuevo. Revisión IA conserva el contrato de semáforo/puntuación que devuelve el servicio, no se fabrica un score nuevo ni se confunde con sensibilidad manual.

## Evidencia y límites
- 22 pruebas nuevas: 9 Herramientas y 13 Modelos. Se agregan a la suite acumulada; no se reemplazan las pruebas anteriores.
- 60 recorridos de navegador, 863 comprobaciones: tres rubros × dos superficies × admin/auditor × cinco anchos (320/390/768/1024/1440). Cero fallos, errores JS o solicitudes externas en ese recorrido. Sin compresión real en PDF.js/CDN.
- Conversiones locales reales con archivos sintéticos: imagen→PDF (1 página), unión PDF (2 páginas), PNG→JPG, descargas TXT y DOCX. IA/guardar/portapapeles simulados donde corresponde; no prueba Storage, DB, RLS, autenticación ni IA reales.
- 164 cotejos de preservación: handlers y procesadores originales, 111 archivos acumulados anteriores, dependencias/acciones/helpers base intactos. Los handlers de guardado solo agregan la compuerta de permiso, sin cambiar carga/formato.
- Incidencias del arnés: Chromium ubicado en /usr/local/bin (no /usr/bin); ruta de sharp corregida sin instalación; conteo de details acotado a revisión (el shell también usa details). Tipos de tests y props opcionales corregidos. Primeros resultados no se consideran aprobados. Capturas estables esperan fin del scroll y quitan foco de prueba; no ocultan controles de producto.

FCK-01, BIB-03, FU-03 y hallazgos previos siguen abiertos. Última auditoría disponible: Next.js y DOMPurify críticos; dependencias sin modificar. Revisión/remediación antes de publicación. El resultado local no constituye validación autenticada ni aplicación completa migrada.

## Lo que sigue — tres grupos de planificación
1. Alquileres, nuevo contrato y formularios de clientes.
2. Completar pantallas aprobadas restantes: Panel, Propiedades, Clientes y Nueva operación.
3. Validación integral autenticada, revisión de seguridad y publicación del conjunto válido en la rama/Preview protegida acordadas. Sin Production ni merge.

Los grupos no son una cantidad garantizada de turnos o pantallas. No se promete fecha sin verificar esos pendientes.

## Cierre de validación
Suite completa final: 1281 pruebas aprobadas en 95 archivos (22 nuevas sobre las 1259 anteriores). Typecheck, lint, build y diff-check aprobados en el cierre. El respaldo acumulado incluye manifiesto de archivos/SHA256 y patch aplicado y cotejado en copia limpia de la base exacta; eso no equivale a un commit o despliegue remoto.
