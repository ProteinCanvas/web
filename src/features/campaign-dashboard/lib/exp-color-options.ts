export const EXP_COLOR_OPTIONS = [
  { key: 'exp_binding', label: 'Binding (hit / miss)' },
  { key: 'exp_kd', label: 'KD — measured (nM)' },
  { key: 'exp_expression', label: 'Expression — measured (%)' },
  { key: 'exp_tm', label: 'Tm — measured (°C)' },
] as const

export type ExpColorKey = typeof EXP_COLOR_OPTIONS[number]['key']
