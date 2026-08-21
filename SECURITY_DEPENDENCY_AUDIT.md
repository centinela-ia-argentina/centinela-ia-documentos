# Informe de Auditoría de Dependencias (SECURITY_DEPENDENCY_AUDIT)

## Estado Inicial
- **Resultado anterior (`npm audit --omit=dev`)**: 1 vulnerability Moderate, 5 vulnerabilities High.
- **Advisories detectados**:
  - `next`: GHSA-p9j2-gv94-2wf4 (SSRF), GHSA-m99w-x7hq-7vfj (DoS), etc. (High)
  - `pdfjs-dist`: GHSA-hq66-cqwq-w95j (High)
  - `sharp`: GHSA-f88m-g3jw-g9cj (High)
  - `postcss`: GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 (High)
  - `nanoid`: GHSA-28wg-ghj8-5hjv (High)
  - `dompurify`: GHSA-c2j3-45gr-mqc4, GHSA-55q2-fjhq-7xh7 (Moderate)

## Intervenciones de Seguridad Ejecutadas

### 1. `next` (y transitivas `sharp`, `postcss`, `nanoid`)
- **Dependencia Directa**: `next` (package.json)
- **Versión anterior**: `16.2.6`
- **Nueva versión**: `16.3.1` (fijada estrictamente vía `--save-exact`)
- **Comando utilizado**: `npm install --save-exact next@16.3.1 pdfjs-dist@6.2.108`
- **Resultados `npm explain`**:
  - `next` es ahora `16.3.1`.
  - `sharp` se actualizó a `0.35.3` (opcional dentro de Next).
  - `postcss` se actualizó a `8.5.23`.
  - `nanoid` se actualizó a `3.3.18`.

### 2. `pdfjs-dist`
- **Dependencia Directa**: `pdfjs-dist` (package.json)
- **Versión anterior**: `6.1.200`
- **Nueva versión**: `6.2.108` (fijada estrictamente vía `--save-exact`)
- **Comando utilizado**: `npm install --save-exact next@16.3.1 pdfjs-dist@6.2.108`
- **Defensa en profundidad en código**: Se aplicó el parámetro `isEvalSupported: false` en `ComprimirPdf.tsx` para inutilizar la ejecución subyacente de JavaScript embebido independientemente de los parches de la librería. Se agregó también chequeo de Magic Bytes.

### 3. `dompurify`
- **Dependencia Transitiva**: Requerido por `jspdf`.
- **Versión anterior**: `3.4.11`
- **Nueva versión**: `3.4.13`
- **Comando utilizado**: `npm audit fix --omit=dev`
- **Resultado `npm explain dompurify`**: La actualización de árbol generó la subida a `3.4.13` cumpliendo el advisory (`>=3.4.12`) manteniéndose encapsulada en `jspdf` sin inyectar dependencias raíz innecesarias.

## Validación y Pruebas
Tras la mitigación, se purgó la caché agresivamente (`rmdir /S /Q node_modules && rmdir /S /Q .next && npm ci`) para garantizar idempotencia.

Se ejecutaron pruebas integrales sobre:
- Carga de documentos e Idempotencia (incluyendo preflight de hash en BD y concurrencia).
- Control de sesión `getUserProfile`.
- Compilación `Next.js` y `Turbopack`.
- Suite `unit` (Vitest), `security` y `e2e` (Playwright) finalizando exitosamente.

## Estado Final
- **Resultado posterior (`npm audit --omit=dev`)**: 0 vulnerabilidades (0 Critical, 0 High, 0 Moderate).
- **Riesgos de Regresión Residuales**: Verificados en entornos de prueba con dependencias bloqueadas y tests locales en verde. Los parches aplicados se mantuvieron dentro del espectro semver menor/parche soportado nativamente por la base del código, no generando colisiones de peer-dependencies (como verificado vía `npm ls`).
- **Validación Final CI**: El pipeline automatizado (Security, E2E y tests RLS) se ejecutará en GitHub Actions una vez emitido el push.
- **Procedimiento de Rollback**: De ser necesario revertir, aplicar `git restore package.json package-lock.json && rm -rf node_modules && npm ci`.

## Certificación Pre-PR
- **Commit Certificado**: 822f46b3272100ba6776298eb3c338ee784aedf3
- **CI Pipeline**: #27 (Run 32443235535)
- **Resultado Final**: Verde
- **Auditoría**: `npm audit --omit=dev` sin vulnerabilidades

## Certificación Definitiva Pre-PR
- **Commit de corrección técnica**: ba0ce8902b6d6c2896a283e4f33999916bc02ad4
- **CI Pipeline técnico**: #29 — Success
- **HEAD validado**: 9a7821e32c752a42377c4506fc38a69485104158
- **CI Pipeline del HEAD**: #30 — Success
- **Resultado**: 15/15 E2E, Build, Security & RLS y Migration & Rollback en verde
- **Auditoría**: `npm audit --omit=dev` sin vulnerabilidades
