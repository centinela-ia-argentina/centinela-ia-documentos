# UI V3 — cierre local y gates de Preview

## Alcance

Acumulado de bloques 1–6 sobre `ae1a5652d4965cb7012fe32886c52ce8ac6a7220`, en la misma rama `feat/anulus-shell-inmobiliaria`. PR #26 permanece Draft. Solo Preview protegida: sin merge ni Production.

La remediación conserva byte por byte los 159 archivos del último acumulado B6. Este cierre agrega dependencias, actualización de expectativas E2E para controles aprobados y navegación autenticada; no cambia acciones de negocio, SQL, políticas ni servicios de aplicación.

## Dependencias

- Next.js y eslint-config-next fijados en 16.4.3.
- DOMPurify 3.4.17 y Zod 4.6.7 resueltos en lockfile.
- Vitest / @vitest/ui fijados en 4.1.12; suite completa repetida tras el cambio de versión mayor.
- Actualizaciones transitivas dirigidas; sin `npm audit fix --force`.
- Overrides limitados a Tailwind CSS 3: postcss-selector-parser 7.1.6 y postcss-nested 7.0.2. No se migra a Tailwind 4. Se recompila la CSS y se repite el arnés visual.
- `npm audit` completo: **0 vulnerabilidades reportadas**, incluidas herramientas de desarrollo. No equivale a certificación de seguridad de toda la aplicación.
- CI pasa de auditar solo producción a auditar todas las dependencias.

## Verificación local

- 1.328 pruebas unitarias / 98 archivos: aprobadas con Vitest 4.
- Lint, TypeScript, build de producción y diff whitespace: aprobados.
- Regresión visual con CSS recompilada: 58 escenarios / 170 comprobaciones, cero fallos, errores JS o solicitudes externas. Los servicios del arnés son ficticios; no acredita autenticación.
- Playwright descubre 210 ejecuciones en 6 archivos / 3 navegadores. Descubrimiento no significa ejecución aprobada.
- Matriz nueva: 9 perfiles sembrados × 2 pantallas × 3 navegadores = 54 ejecuciones adicionales. Incluye tres administradores sectoriales, empleados/auditores/clientes jurídicos y notariales; no inventa perfiles inmobiliarios ausentes del seed.
- Navegación nueva de solo lectura: Inicio, Documentos, Agenda, Expedientes, overflow, menú móvil/Escape/foco y rechazo de agente para roles de consulta.
- E2E existentes conservan comprobaciones de persistencia, permisos, fuentes y aislamiento. Los formularios plegables y confirmaciones se abren explícitamente; se espera la respuesta de la acción de servidor, sin sustituir estados por pausas arbitrarias.

## Gates remotos obligatorios

No se ejecutaron pruebas autenticadas locales: este equipo no dispone de Docker/Supabase ni credenciales de prueba. Se utiliza el pipeline existente, con Supabase efímero de loopback, usuarios ficticios y AI simulada. No se ejecutan seeds, migraciones o escrituras de QA contra servicios reales.

Para dar el cierre por aprobado deben pasar, **sobre el SHA final**:
1. auditoría, lint, tipos, unitarias y build;
2. seguridad/RLS y drift;
3. migraciones/rollback;
4. E2E autenticados completos;
5. despliegue de Preview listo y protección de acceso verificada.

Los checks verdes de commits anteriores no aprueban este acumulado. La existencia de comentarios de Vercel tampoco acredita un despliegue listo. El enlace de Preview continúa redirigiendo acceso anónimo a SSO de Vercel en la comprobación previa a publicación; no se elude la protección.

Si un gate falla se conserva PR Draft y se reporta el fallo: no se etiqueta el producto listo ni se fusiona automáticamente.
