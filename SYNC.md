# SYNC.md — Protocolo de estandarización UI/UX

> Este es el estándar visual y de experiencia de Anulus AI Documentos.
> **Toda pantalla, componente o fix de UI debe cumplirlo.** Si el código contradice este documento, se corrige el código (o se actualiza el documento con aprobación expresa del usuario).
> Los cambios a este protocolo se registran en `CHANGELOG.md`.

## 1. Fuentes

| Rol | Fuente | Dónde |
|---|---|---|
| UI (toda la app) | **Manrope** (`--font-ui`) | Todos los módulos internos, formularios, listados, agenda, reportes |
| Display (solo landing) | **Space Grotesk** (`--font-display`) | Únicamente páginas de marketing (`/`, `/como-funciona`, `/funciones`, `/planes`, `/plataforma`, `/seguridad` y textos legales de marketing). Nunca dentro del shell de la app. |
| Datos | **JetBrains Mono** (`--font-mono`) | Números de expediente/operación, montos, fechas de vencimiento, porcentajes, códigos, referencias, tamaños de archivo. Siempre con `font-variant-numeric: tabular-nums`. |

Regla de decisión: si el elemento es un **dato que se compara, escanea o copia**, va en mono. Si es **texto que se lee**, va en Manrope. Los títulos de la app nunca van en mono ni en display.

## 2. Escala tipográfica (tokens en `globals.css`)

| Token | Uso | Valor |
|---|---|---|
| `--text-h1` | Título de página | 34px / 1.2 / 600 / tracking -1px |
| `--text-h2` | Título de sección / modal | 21–23px / 1.35 / 600 / tracking -0.5px |
| `--text-h3` | Título de tarjeta / subsección | 15–18px / 1.5 / 600 |
| `--text-body` | Texto base de la app | 13px / 1.8 |
| `--text-small` | Meta, ayuda, filas | 11px / 1.7 |
| `--text-caption` | Eyebrow / etiquetas de tabla | 9–10px, mayúsculas, letter-spacing 1px, color muted |

La app usa escala compacta: los saltos son suaves y la jerarquía se apoya más en peso y color que en tamaño. Está bien así; no inflar títulos.

## 3. Paleta y superficie (modo claro / grafito)

- Fondo de app: `#fafafa` (superficie neutra cálida). Cards y paneles: blanco puro con borde.
- Texto principal: `#25272a` (grafito). Secundario/muted: `#626b73`. Nunca gris más claro que `#858e93` para texto que se lee.
- Bordes: `#e3e4e5` (suave) / `#d9dddd` (estructura). Los bordes son de 1px, sólidos, sin difuminados.
- Colores semánticos: éxito (verde sobrio), advertencia (ámbar), peligro (rojo suave: texto `#a33f38`, borde `#e4c1bd`, fondo `#fcf3f2`), información (gris/azul muy apagado).
- Focus visible: outline 2px `#415a71`, offset 2–3px. Un único valor de focus en todo el sistema (converger los residuales `#3d526c` durante S4).
- La landing usa su propia paleta oscura (verde lima `#c8ff62` + teal) y **no se mezcla** con la app.

## 4. Botones

Jerarquía obligatoria (en este orden de decisión):

1. **Principal** → grafito sólido (`#25272a`), texto blanco.
2. **Consultar / secundario** → blanco con borde `#cbd0d2`.
3. **Habilitar / iniciar flujo** → verde sobrio solo cuando la acción "enciende" algo (ej: analizar).
4. **Cancelar / destruir** → rojo suave (borde `#e4c1bd`, texto `#a33f38`), sin relleno fuerte.
5. Ghost → sin borde, para acciones dentro de una misma superficie.

- Alturas: 44px en formularios y acciones principales; 32–36px en barras compactas y filas.
- Botón destruido/deshabilitado: opacidad reducida + `cursor: not-allowed`; nunca gris invisible.
- Un solo botón principal por vista. Si hay dos, hay un problema de jerarquía que resolver.

## 5. Componentes

- **Select**: siempre `SelectField` (`@/components/ui/SelectField`), nunca `<select>` nativo. El trigger muestra el valor y el label va en `aria-label`; el menú abre hacia arriba si falta espacio, con scroll interno.
- **Pills / badges**: alto 28px máximo, borde 1px, fondo `#f0f2f1`, sin color de marca. Los estados semánticos de pill llevan el punto de color, no el fondo.
- **Cards**: bordes 1px `#e3e4e5`, radio 7–10px, sin sombras difusas (sombra permitida: `0 1px 2px #0000000c`).
- **Modales**: `<dialog>`, fondo `#fafbfa`, borde `#d9dddd`, radio 10px, `overscroll-behavior: contain`; backdrop `#25272a55`.
- **Radios estándar**: 4px (elementos internos) · 5px (inputs/botones) · 7px (cards) · 10px (modales). Tokens `--radius-sm/--radius/--radius-lg`.
- **Espaciado**: múltiplos de 4px. Margen base entre secciones: 24–32px.

## 6. Los 5 estados obligatorios

Toda acción asincrónica y toda vista de datos debe contemplar:

1. **Vacío** — texto que explica qué va a pasar acá y qué hacer primero; nunca un vacío mudo.
2. **Carga** — skeleton o spinner discreto; sin saltos de layout.
3. **Progreso parcial / streaming** — indicar que la IA está trabajando sin prometer resultado.
4. **Error** — mensaje claro, con acción de reintento que **conserva lo que el usuario escribió**.
5. **Éxito** — confirmación discreta (banda o línea), sin celebraciones ni emoji.

## 7. UX Writing

- Español rioplatense: tratamos de "vos" ("Seleccioná", "Subí", "Revisá").
- Botones con secuencia verbo + objeto exacto ("Subir documento", no "Enviar").
- Help text debajo de los campos complejos; nunca solo en el placeholder.
- Los avisos de IA dicen siempre qué hace la IA y qué NO hace ("Subir no implica analizar ni confirmar validez documental").
- Error messages: qué pasó + qué hacer. Nunca culpar al usuario.

## 8. Prohibiciones (anti-slop)

Estas reglas no se negocian:

1. Sin violeta ni azul neón en la app.
2. Sin glow, sin sombras difusas, sin gradientes decorativos en el shell interno.
3. Sin cards decorativas que no tengan acción.
4. Sin métricas inventadas ni datos decorativos falsos.
5. Sin emoji en la interfaz.
6. Sin adoptar código de librerías de componentes externas (21st.dev, reactbits, magicui, uiverse): estilo genérico ≠ identidad propia. Solo referencia de microinteracciones, siempre reimplementado.
7. Sin islands de estilo: un módulo nuevo arranca de los tokens y componentes existentes, no de su propio CSS paralelo.

## 9. Convenciones de trabajo

- Conventional Commits (`feat`, `fix`, `refactor`, `test`, `ci`, `docs`).
- Rama por paquete, Draft PR contra `main`, CI verde (Unit/Security/E2E/Migration) antes de Ready for review.
- Al migrar un select a SelectField: grep de `combobox|selectOption` en todo el repo antes de cerrar el lote (unit + e2e). El trigger de SelectField se testea con `toHaveAccessibleName` para labels y `toContainText` para valores.
- Muestras de UI: solo en `.tmp-muestras/` (nunca commitear); se aprueban por captura y se implementan después.
- Cambios de presentación se revisan en el Preview real de Vercel (diseño verdadero), no en muestras paralelas.

## 10. Deuda conocida (no la considéres estándar)

- ~~Ligera variación de gris de texto entre módulos legacy (`#252a2d`, `#272b2e`, `#25272a`) — converger en S4.~~ **Convergido en S4 Fase A** (PR `feat/s4-faseA-grises`): todos los módulos usan `#25272a`. No introducir otros grises de texto principal.
- Dos valores de focus (`#3d526c` / `#415a71`) — converger en S4.
- Módulos con CSS propio extenso (Propiedades, PropertyDetail, Copiloto, Viewer, IndustryTools) — migración de islas en S4 por fases.
