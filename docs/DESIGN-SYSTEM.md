# Design System — Anulus AI / Centinela IA Documentos

Fuente de verdad del estándar visual de la aplicación. Este documento resume las reglas
permanentes; el detalle operativo por módulo vive en `SYNC.md` (raíz del repo) y el
catálogo interactivo en la página `/ui-kit` de la app (solo usuarios admin).
Metodología de trabajo UI en `docs/skills-audit.md` y registro de auditorías en el
CHANGELOG (una entrada por PR).

## 1. Tipografía

| Uso | Fuente | Notas |
|---|---|---|
| Toda la aplicación | **Manrope** | Interface única; pesos 400/500/650 |
| Landing (marca) | **Space Grotesk** | SOLO landing y `BrandWordmark`; nunca en módulos internos |
| Datos protagonistas | **JetBrains Mono** | Peso 500 + `tabular-nums`; datos densos y de tabla: fechas, expedientes, montos en listas, dd, `.when`, `.uploadResults dd` |
| Números héroe (carteras y paneles) | **Manrope** | Peso 600 + `tabular-nums` + tracking −0.01em; el precio/métrica protagonista de una ficha (propiedades, clientes, tiles grandes). Decisión 24/11: el mono lee como código en tamaños grandes; el héroe se habla en la tipografía de la app |

Regla en dos niveles: el dato denso de una lista o tabla se habla en mono; el número protagonista de una ficha se habla en Manrope 600 tabular.

### Fallbacks de datos (decisión 24/11, "No cargado")
- Un fallback ("No cargado", "Sin definir", "Sin contacto registrado") es **texto de UI, nunca un dato**: va en Manrope, peso 500, color `#626b73`, sin tabular-nums, sin mono.
- Nunca se muestra un `0` ni una línea vacía como falso dato; el cero real (precio 0, superficie 0) SÍ es dato y se muestra.
- En números héroe (precio de ficha, presupuesto), el fallback entra en tamaño de texto normal dentro del mismo contenedor.

## 2. Color

### Superficies y grises
- **Único gris de texto: `#25272a`** (convergido en S4-Fase A; prohibido `#25272a`/`#2c2c2b` mezclados en superficie nueva — usar el token).
- Fondos de módulos claros: `#fafafa` con borde `#d9d9d6`, radius 10px.
- Temas oscuros (calculadoras, protocolo, tasación, índices, chat del agente): mantener su fondo propio hasta su lote de alineación visual; no mezclar componentes claros sobre oscuro.

### Estados
- **Focus visible único: `#415a71`** (outline 2px, offset 1–2px). Prohibido reintroducir `#3d526c` o variantes.
- Éxito: verde del sistema; advertencia: ámbar del sistema; error: rojo suave + mensaje en español (nunca códigos técnicos: `error_descarga` → "No se pudo descargar el archivo. Probá de nuevo en unos segundos.").

### Botones (jerarquía fija)
1. **Principal**: grafito sólido (`#2c2c2b`, texto blanco).
2. **Consultar/secundario**: blanco con borde.
3. **Habilitar**: verde.
4. **Cancelar**: rojo suave.

### Radios y pills
- Radios del sistema: 4 / 5 / 7 / 10 px.
- Pills de estado ≤ 28px de alto, con punto de color (sin glow ni sombra).

## 3. Prohibiciones (anti-slop, permanentes)

- Sin violeta ni azul neón.
- Sin glow, sin sombras difusas, sin cards decorativas.
- Sin métricas inventadas ni porcentajes sin dato real detrás.
- Sin emoji en la interfaz (los íconos son Phosphor, stroke 1.6–1.8px).
- Sin adoptar código visual de librerías externas (shadcn, Tailwind UI, etc.).

## 4. Componentes del sistema (`src/components/ui/`)

| Componente | Uso |
|---|---|
| `AppButton` / `AppButtonLink` | Botón base con las 4 variantes de jerarquía |
| `SelectField` | Select nativo desplegable (controlado o no controlado, placeholder, `data-select-option` en opciones). Opciones compactas 40px sin borde; `min-w-0` en el root para encoger en columnas angostas |
| `FormSubmitButton` | Submit con estado pending integrado |
| `WorkflowStepper` | Pasos de procesos multi-etapa |
| `MotionCard` | Card con transición sobria |
| `CollapseArea` (expedientes) | Sección plegable de herramientas (patrón "Consultar al agente"): header con label + hint + caret, cuerpo siempre montado con `hidden` |
| `CaseAgentDisclosure` | Despliegue del chat del agente en fichas |

Reglas de SelectField (aprendidas en Lote 2):
- El popup es space-aware (estima espacio arriba/abajo del trigger).
- En layouts con columnas fijas angostas (ej. columna de datos de 235px), el root lleva `min-w-0`: el texto largo corta con elipsis y el popup no desborda la columna.
- Las opciones llevan `data-select-option=""` para quedar excluidas de reglas de botones de módulos (`:where(:not(...,[data-select-option]))`).

## 5. Estados de IA (los 5 estados)

Toda acción IA largo debe tener: vacío, carga (spinner + hint "Esto puede tardar hasta un minuto. No cierres la página."), progreso (`aria-busy`), error (mensaje humano, rol alert) y éxito (rol status). Referencia: PR #38.

## 6. No migrar (excepciones documentadas)

- Landing y `BrandWordmark` (Space Grotesk es la marca).
- Mocks y muestras con Georgia/Arial (material de comparación, no producción).
- Superficies de tema oscuro pendientes de su lote de alineación (sub-lote oscuro).
