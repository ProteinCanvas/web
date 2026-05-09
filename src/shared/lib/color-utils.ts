export function interpolateColor(t: number): string {
  const r = Math.round(59 + (239 - 59) * t)
  const g = Math.round(130 + (68 - 130) * t)
  const b = Math.round(246 + (68 - 246) * t)
  return `rgb(${r},${g},${b})`
}
