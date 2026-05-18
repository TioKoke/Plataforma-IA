# Plataforma IA — Design System

Snapshot del sistema de diseño del frontend. Para reglas detalladas y ejemplos, ver las skills [`plataforma-brand-system`](~/.claude/skills/plataforma-brand-system/SKILL.md) y [`plataforma-ui-component-patterns`](~/.claude/skills/plataforma-ui-component-patterns/SKILL.md).

## Tokens

### Colores (marca Plataforma IA)

Definidos en [tailwind.config.js](tailwind.config.js) y exportados tipados desde [src/styles/tokens.ts](src/styles/tokens.ts).

| Token Tailwind            | Hex       | Rol                              |
|---------------------------|-----------|----------------------------------|
| `plataforma-naranja`         | `#E55302` | CTA primario, acento de marca    |
| `plataforma-amarillo`        | `#F4AA00` | Acento secundario, gradientes    |
| `plataforma-turquesa`        | `#0098AA` | Info, links, estados "thinking"  |
| `plataforma-verde-oscuro`    | `#106470` | Success                          |
| `plataforma-rojo`            | `#C13832` | Error, destructivo               |
| `plataforma-rojo-oscuro`     | `#7A2531` | Error hover                      |
| `plataforma-azul`            | `#0072B1` | Info secundaria, charts          |
| `plataforma-gris-oscuro`     | `#36424A` | Texto fuerte                     |
| `plataforma-beige`           | `#C4C1A0` | Neutros, dividers                |

Semánticos shadcn (HSL) definidos en [src/index.css](src/index.css): `bg-background`, `text-foreground`, `border-border`, etc. Usar éstos en componentes que deban respetar dark mode.

### Tipografía

- **Montserrat** (600/700) → headings. Clase: `font-montserrat font-semibold`.
- **Roboto** (400/500) → body. Clase: `font-roboto`.
- Fuentes cargadas desde `@fontsource` en [src/main.tsx](src/main.tsx).

### Motion

Duraciones y stagger estándar en [src/styles/tokens.ts](src/styles/tokens.ts):
- Micro (hover): `150ms`
- Enter/exit: `250–350ms`
- Stagger entre items: `0.06–0.08s`

## Componentes UI (primitivos)

En [src/components/ui/](src/components/ui/):

| Archivo                              | Descripción                                          |
|--------------------------------------|------------------------------------------------------|
| [button.tsx](src/components/ui/button.tsx)    | Botón shadcn con variantes            |
| [card.tsx](src/components/ui/card.tsx)        | Card estructural                      |
| [badge.tsx](src/components/ui/badge.tsx)      | Badge/pill                             |
| [tooltip.tsx](src/components/ui/tooltip.tsx)  | Tooltip ligero (sin Radix)             |
| [skeleton.tsx](src/components/ui/skeleton.tsx)| Placeholder animado                    |
| [separator.tsx](src/components/ui/separator.tsx)| Divisor h/v                          |
| [input.tsx](src/components/ui/input.tsx)      | Input con focus ring naranja           |

## Componentes de dominio

| Componente                                                               | Patrón aplicado                           |
|--------------------------------------------------------------------------|-------------------------------------------|
| [MessageActions](src/components/chat/MessageActions.tsx)                  | Icon-only + Tooltip + aria-labels + focus ring |
| [ThinkingProcess](src/pages/ChatPage.tsx#L9)                              | Stagger framer-motion + accent turquesa   |
| [DashboardPage KPI cards](src/pages/DashboardPage.tsx)                    | `motion.div` con entrada + `whileHover`   |
| [SpotlightCard](src/components/reactbits/SpotlightCard.tsx)               | Contenedor con spotlight radial           |

## Accesibilidad

- **Skip link** en [Layout.tsx](src/components/Layout.tsx) → `#main-content`.
- **Landmarks:** `<main id="main-content">`, `<nav aria-label="Navegación principal">`.
- **Focus rings** uniformes: `focus-visible:ring-2 focus-visible:ring-plataforma-naranja`.
- **Toolbar ARIA** en grupos de acciones (ej. MessageActions).
- Pendiente: auditar `alt` genéricos en AgentsPage y LearnPage.

## Do / Don't

✅ `bg-plataforma-naranja text-white hover:bg-[#CC4A00]`
✅ `font-montserrat font-semibold text-3xl`
✅ `focus-visible:ring-2 focus-visible:ring-plataforma-naranja focus-visible:ring-offset-2`

❌ `bg-orange-500` — usar `plataforma-naranja`
❌ `title="..."` para tooltips — usar `<Tooltip>` de `ui/tooltip`
❌ Iconos sin `aria-label` en botones icon-only
