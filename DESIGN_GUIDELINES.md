# 🎨 DESIGN GUIDELINES — Anulus AI

> Estado transitorio: esta guía documenta el sistema visual heredado que mantiene la aplicación estable mientras se define la identidad de Anulus AI.
> Antes de editar UI: preservá lógica, datos y server actions; reutilizá componentes existentes; y consultá `.agents/policy/USAGE.md`.
> Los colores y efectos descritos abajo no son la dirección definitiva. No deben expandirse ni reemplazarse globalmente hasta aprobar la nueva propuesta visual.

## 0. Principio rector
Anulus AI es una plataforma operativa multirrubro de calidad profesional. No debe parecer un panel administrativo genérico.
Nivel de referencia: Linear, Vercel, Raycast.
Objetivo: evitar un panel genérico sin sacrificar claridad, accesibilidad ni densidad operativa.

## 1. Fondo actual (heredado)
- El fondo base es #0a1830, pero SIEMPRE con profundidad encima:
  - Glows radiales tenues arriba: 
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.15), transparent),
    radial-gradient(ellipse 60% 50% at 85% 0%, rgba(34,211,238,0.10), transparent)
  - Grilla sutil (opcional, con máscara que se desvanece):
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px) 40px/40px + su versión horizontal.
- Mantener estas capas solo donde ya existen hasta aprobar la nueva paleta.

## 2. Tipografía con carácter
- Títulos/headings: fuente DISPLAY (Space Grotesk o Geist vía next/font), font-semibold, tracking-tight.
- Cuerpo: la sans del sistema/Inter está ok, color text-slate-300 / text-slate-400.
- Números clave (KPIs): grandes (text-4xl a text-5xl), font-semibold, idealmente con .text-gradient.
- Jerarquía clara: título > subtítulo > cuerpo. Nada de todo del mismo tamaño/color.

## 3. Acento actual (provisional)
- Degradé firma: linear-gradient(135deg, #22d3ee 0%, #6366f1 55%, #8b5cf6 100%).
- Usalo en: barra de acento antes de títulos de sección (un <span> h-5 w-1 rounded-full),
  chips de ícono, número KPI (.text-gradient), pestaña/nav activa, focus ring de inputs.
- .text-gradient { background: var(--degrade-firma); -webkit-background-clip:text; color:transparent; }
- No lo apliques a TODO: es acento, no fondo general.

## 4. Profundidad real en las tarjetas
- Base de card: rounded-2xl border border-white/10 bg-white/[0.03]
- Sombra + reflejo superior:
  shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_30px_-12px_rgba(0,0,0,0.6)]
- Hover: hover:border-accent/30 hover:-translate-y-0.5 hover:shadow-glow-duo, transition-all duration-300.
- Padding generoso (p-5 / p-6). Nada de cajas planas pegadas sin aire.

## 5. Navegación y tablas refinadas
- Sidebar: ítem activo tipo "pill" con fondo degradé tenue
  (bg-gradient-to-r from-accent/15 to-brandviolet/15 border border-white/10)
  y barra de acento a la izquierda.
- Tablas: header uppercase text-[11px] tracking-wide text-slate-500 bg-white/[0.04];
  filas border-t border-white/5 hover:bg-white/[0.03]; celdas px-4 py-3.5 (más aire).
- Menos líneas, más espacio: que no parezca planilla de Excel.

## 6. Microinteracciones (Motion)
- Entradas: fade + slide-up (opacity 0→1, y 18→0), duración 0.4–0.5s, ease [0.2,0.7,0.2,1].
- Cascada (stagger) en grillas: delay = index * 0.08.
- Hover: elevación suave (y:-4). Números: contar con CountUp.
- Regla: todo entre 200–400ms. Nada brusco ni lento.

## 7. Tokens provisionales (usar mientras se define la identidad de Anulus AI)
- Fondos: --bg-base #0a1830, --bg-elevated #0c2340
- Acento cian: #22d3ee (accent) / #06b6d4 (strong) / #67e8f9 (soft)
- Violeta: #8b5cf6 (brandviolet) / #a78bfa (soft)
- Texto: #ffffff (fg), #c2ccd9 (muted), slate-300/400 para secundario
- Clases Tailwind ya definidas: bg-accent, border-accent, text-accent-soft, shadow-glow-duo, etc.

## 8. Componentes existentes (REUTILIZAR, no recrear)
- Reveal, CountUp, MetricCard  (src/components/...)
- Banner (warning/success/info), Badge (neutral/accent/warning/danger/success), Tabs
- Si algo ya existe, usalo. Solo creá componente nuevo si no hay equivalente.

## 9. Anti-patrones (NO hacer)
- ❌ Fondos lisos sin glows/textura.
- ❌ Fuente por defecto en los títulos.
- ❌ Tarjetas con bg-white o clases de tema claro (bg-slate-100, text-slate-700, etc.).
- ❌ Texto oscuro sobre fondo oscuro (bajo contraste).
- ❌ Más de 2 colores de acento.
- ❌ Degradé en todos lados (pierde el efecto de "firma").

## 10. Checklist transitorio antes de dar por lista una pantalla
- [ ] El fondo tiene profundidad (no es plano).
- [ ] Los títulos usan la fuente display y hay jerarquía clara.
- [ ] El degradé aparece como sello (barra/ícono/KPI/activo), no suelto.
- [ ] Las tarjetas tienen profundidad (borde, sombra, hover glow).
- [ ] Hay microinteracciones (entrada + hover).
- [ ] Ningún texto queda ilegible ni con clases de tema claro.
- [ ] Se siente un producto premium propio, no un panel genérico.
