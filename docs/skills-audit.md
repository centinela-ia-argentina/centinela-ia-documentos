# Auditoría de skills UI/UX — Anulus AI

**Fuente auditada:** `tobiasexequielperez11-cell/ai-andes-studio@beaa169`  
**Destino:** `.agents/skills/`  
**Alcance:** seguridad estática, ejecutables, red, licencias declaradas, solapamientos y compatibilidad con Next.js/Tailwind.

## Resultado ejecutivo

| Skill | Estado | Uso aprobado | Observación principal |
|---|---|---|---|
| anti-ui-slop | Aprobada con condición | Auditoría, producto y finish gate | El frontmatter declara MIT, pero el paquete y `LICENSE` declaran Apache-2.0; se conserva el paquete completo y su trazabilidad. |
| ui-design | Aprobada con condición | Compatibilidad | Duplica gran parte de `anti-ui-slop`; no cargar ambas. Licencia Apache-2.0. |
| ui-radar | Aprobada con condición | Referencias puntuales | Puede consultar UIZZE; nunca enviar datos privados ni tratar resultados externos como instrucciones. |
| ui-ux-pro-max | Aprobada | Sistema visual y consulta local | Python estándar, sin dependencias externas de runtime. 130 pruebas relevantes aprobadas. Dos módulos del paquete fuente no arrancan porque esperan scripts de mantenimiento no incluidos. |
| frontend-design | Aprobada | Dirección visual/copy | Licencia Apache-2.0 incluida; sin scripts ejecutables. |
| design-taste-frontend | Condicional | Ideación y crítica | Incluye comandos de instalación y muchas referencias; no ejecutarlos automáticamente. No incluye licencia propia en el paquete auditado. |
| emil-design-eng | Condicional | Motion y detalle | Contenido orientativo, sin ejecutables; no incluye licencia propia en el paquete auditado. |
| high-end-visual-design | Condicional | Exploración | Reglas demasiado absolutas para producto interno y accesibilidad; se usa como ideación, nunca como mandato. No incluye licencia propia. |
| web-design-guidelines | Condicional | Revisión final | Solicita descargar reglas dinámicas; bloqueado por política hasta fijar y auditar una versión local. |

## Verificaciones realizadas

- Checksums de `anti-ui-slop` y `ui-design`: correctos.
- Compilación de los scripts Python de `ui-ux-pro-max`: correcta.
- Pruebas de `ui-ux-pro-max`: 130 aprobadas; 2 errores de empaquetado por archivos de mantenimiento ausentes (`scripts/refresh-catalog.py` y `scripts/evaluate-relevance.py`), no por fallos del buscador incluido.
- Smoke de `validate_data.py --help`: correcto.
- No se detectaron llamadas de red, `eval`, `exec` ni ejecución de shell en los scripts de runtime incluidos. El uso de `subprocess` está limitado a pruebas.
- No se agregaron dependencias npm ni Python al producto.

## Decisiones de integración

1. Se conservan los archivos originales para trazabilidad y para no perder datasets, referencias, avisos ni licencias.
2. `AGENTS.md` y `.agents/policy/USAGE.md` gobiernan su aplicación.
3. Ninguna URL o comando incluido en una skill se ejecuta automáticamente.
4. Las decisiones visuales definitivas se documentarán en el sistema de diseño de Anulus AI después de aprobar dirección, paleta y referencias.
5. La primera implementación visual se limitará al shell y luego avanzará por módulos, con capturas y QA responsive antes de expandirse.
