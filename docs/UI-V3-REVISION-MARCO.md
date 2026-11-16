# Revisión del marco: pantalla completa y desplazamiento

Base: main `f2175b6cc8f8aca9897e39d134def1996423fac1` (PR #26).
Rama: `fix/v3-fullscreen-shell-scroll`. Sin merge ni promoción a Production.

## Defectos reproducidos

- Shell.module.css conservaba margin 16px/12px, borde, radio y sombra de presentación: la aplicación parecía una tarjeta flotante en vez de ocupar el viewport.
- La cabecera sticky a top 16px/12px permanecía dentro del área de lectura durante el scroll nativo. El contenido podía aparecer detrás y también por encima, en el hueco superior.
- La barra lateral fija y el disparador móvil conservaban los offsets de ese marco.

## Solución acotada

- Marco sin margen, borde, radio ni sombra; altura mínima 100dvh. Se retira el máximo arbitrario de 1600px del main.
- Sidebar de escritorio alineada a top/left/bottom 0; conserva su ancho y el scroll propio de navegación.
- Cabecera en flujo normal: reserva su espacio y se desplaza con la página. NO es una nueva cabecera fija. Así se elimina la superposición sin introducir un segundo scroll en main ni cambiar la restauración nativa de navegación.
- Menú móvil sigue siendo modal; su disparador acompaña la cabecera en vez de quedar flotando sobre el contenido.
- Se preservan márgenes interiores de lectura, tarjetas funcionales, rutas, permisos, contenido, acciones, datos, landing y autenticación.

## Pruebas

- Dos contratos unitarios nuevos del CSS y extensión de la matriz autenticada V3 existente con geometría de pantalla completa, relación main/header y desplazamiento real.
- Fixture local con ShellFrame/Sidebar/Topbar y componentes reales; datos ficticios, sin backend ni solicitudes HTTP(S). 40 escenarios en ocho tamaños, cinco contextos (control, cliente, lector, jurídico, escribanía), 402 comprobaciones sin fallos. Incluye scroll por rueda, navegación móvil/Escape/retorno, enlace Saltar al contenido, colores forzados y reflujo a zoom CSS 125%/200%; no certificación de zoom nativo ni WCAG.
- Capturas adicionales de DashboardView real con datos ficticios a 1366px y 390px. Comparación antes/después usa los mismos componentes/datos, sustituyendo únicamente el CSS del marco anterior.
- Validación local de cierre y resultados remotos se registran al finalizar; las pruebas locales no acreditan un despliegue visible.

## Archivo visual

`UI-V3-INVENTARIO-VISUAL.md` distingue el traslado específico de cada pantalla de la herencia de controles compartidos. El catálogo entregable reúne originales recuperados, con versiones/procedencia, no una recreación histórica ni una afirmación de paridad visual total.

## Cierre local

- Typecheck, ESLint, build optimizado de Next y `git diff --check`: correctos.
- Suite unitaria completa repetida: 1382 tests correctos en 102 archivos.
- Primera pasada: 1381 correctos y un fallo intermitente en PropertyWorkspace.test.ts, ajeno al CSS editado; su repetición aislada pasó 10/10. La causa de esa intermitencia no queda diagnosticada por esta revisión.
- La matriz autenticada extendida queda pendiente de CI con backend descartable. No se ejecutó contra datos reales ni se usaron seeds en producción.
- La comprobación local no sustituye la revisión de Preview, las compuertas remotas del nuevo SHA ni la verificación posterior del dominio de producción.
