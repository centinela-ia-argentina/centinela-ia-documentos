# Diagnóstico E2E del candidato 4250ccef · corrección 1

Fuente: informe Playwright adjunto por el usuario, ejecución 40034962898, SHA 4250ccef1118990a4b1f95fd4ff55748cf082f75. Se analizaron los resultados estructurados y las trazas locales; no se publican trazas ni estados de sesión en el repositorio.

## Resultado original, no aprobado

210 ejecuciones: 146 aprobadas, 18 fallidas, 1 inestable y 45 omitidas por el encadenamiento serial. Las 45 omitidas requieren nueva ejecución; no se contabilizan como aprobadas.

## Causas verificadas y correcciones

1. **Alta de clientes (3 fallos, un caso en tres navegadores).** `text=Registrar nuevo cliente` encuentra breadcrumb y h1. Se usa `getByRole('heading', { name: 'Registrar nuevo cliente', exact: true })`. No se cambia la pantalla ni se oculta una coincidencia con `first()`.
2. **Vínculo de checklist (3 fallos, un caso en tres navegadores).** El filtro `form.filter({has: row.getByTestId(...)})` vuelve a buscar el ancestro dentro del formulario. Se seleccionan documento y botón directamente en la fila por sus test IDs existentes, tanto en el caso jurídico como en la fixture inmobiliaria que aún no había llegado a ejecutarse. Se preservan assertions de URL, feedback, estado, persistencia DB/recarga, desvinculación y reversibilidad.
3. **Matriz cliente/Agenda (12 fallos: dos roles cliente, dos pantallas, tres navegadores).** La traza llega a `/agenda` y el middleware la deniega intencionadamente para clientes. La prueba debe verificar esa denegación, no exigir acceso. Ahora comprueba URL de permiso insuficiente y encabezado, y continúa con las rutas permitidas y el menú. **No se amplían permisos ni se cambia middleware/RLS.**
4. **Espera de confirmación (1 caso inestable).** La espera `response.finished()` agota el timeout al esperar el fin del stream RSC. Se espera la respuesta POST de acción con estado HTTP no fallido y se mantienen las comprobaciones observables posteriores de estado/URL. No se aumentan timeouts ni se agregan sleeps.

## Validación y diagnóstico futuro

- Arnés local con el componente real `CaseChecklistPanel`, acciones ficticias y respuesta HTTP deliberadamente sin finalizar: **18 comprobaciones aprobadas**, pantallas 390/1440. Cubre marcar recibido/pendiente, vincular/desvincular, feedback y conservación del estado. No acredita autenticación o persistencia real.
- No se modifican fuentes de aplicación, permisos, consultas, SQL, dependencias ni configuración de despliegue.
- Playwright en CI agrega reporter `github` junto a HTML. Un próximo fallo dejará anotaciones con diagnóstico de tests en GitHub, además del artefacto HTML; no requiere instalar otra conexión ni cambiar permisos del repositorio. No se agregan tokens ni credenciales para este cambio de reporter.
- El cierre solo se aprueba con la nueva ejecución autenticada y todos los gates sobre su nuevo SHA. PR #26 permanece Draft, Preview protegida, sin merge ni Production.
