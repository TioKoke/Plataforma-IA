/**
 * Plataforma IA — Design Tokens
 *
 * Typed constants mirroring tailwind.config.js + index.css.
 * Import from TSX when you need token values at runtime
 * (framer-motion props, recharts colors, inline styles).
 *
 * For static Tailwind classes, prefer `bg-plataforma-naranja` etc.
 */

export const colors = {
  naranja: "#E55302",
  amarillo: "#F4AA00",
  turquesa: "#0098AA",
  rojo: "#C13832",
  rojoOscuro: "#7A2531",
  grisOscuro: "#36424A",
  beige: "#C4C1A0",
  verdeOscuro: "#106470",
  azul: "#0072B1",
} as const;

export const semanticColors = {
  primary: colors.naranja,
  accent: colors.amarillo,
  info: colors.turquesa,
  success: colors.verdeOscuro,
  danger: colors.rojo,
  dangerStrong: colors.rojoOscuro,
} as const;

export const chartPalette = [
  colors.naranja,
  colors.turquesa,
  colors.amarillo,
  colors.verdeOscuro,
  colors.azul,
  colors.rojo,
] as const;

export const motion = {
  duration: {
    micro: 0.15,
    short: 0.25,
    medium: 0.35,
    long: 0.5,
  },
  stagger: {
    tight: 0.06,
    normal: 0.08,
    loose: 0.12,
  },
  ease: {
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],
    inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  },
} as const;

export const radius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const shadows = {
  card: "0 1px 3px rgb(0 0 0 / 0.08), 0 1px 2px rgb(0 0 0 / 0.04)",
  elevated: "0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.06)",
  glowOrange: "0 0 20px rgb(229 83 2 / 0.25)",
} as const;

export type BrandColor = keyof typeof colors;
