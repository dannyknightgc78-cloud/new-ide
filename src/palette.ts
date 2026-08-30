import { Color } from 'appclipcode'

export { Color }

export function midpointColor(a: Color, b: Color): Color {
  return new Color(
    Math.floor((a.r + b.r) / 2),
    Math.floor((a.g + b.g) / 2),
    Math.floor((a.b + b.b) / 2),
  )
}
