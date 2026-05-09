export interface MetricMeta {
  label: string
  unit?: string
  direction: 'higher' | 'lower' | 'neutral'
  goodThreshold?: number
  goodThresholdScale100?: number
  description: string
}

export const METRIC_REGISTRY: Record<string, MetricMeta> = {
  plddt: {
    label: 'pLDDT',
    direction: 'higher',
    goodThreshold: 0.8,
    goodThresholdScale100: 80,
    description: 'Per-residue local confidence (0–1 or 0–100)',
  },
  i_plddt: {
    label: 'i_pLDDT',
    direction: 'higher',
    goodThreshold: 0.8,
    goodThresholdScale100: 80,
    description: 'Interface pLDDT',
  },
  ss_plddt: {
    label: 'ss_pLDDT',
    direction: 'higher',
    goodThreshold: 0.8,
    goodThresholdScale100: 80,
    description: 'Secondary structure pLDDT',
  },
  ptm: {
    label: 'pTM',
    direction: 'higher',
    goodThreshold: 0.7,
    description: 'Predicted TM-score (global fold confidence)',
  },
  iptm: {
    label: 'ipTM',
    direction: 'higher',
    goodThreshold: 0.5,
    description: 'Interface predicted TM-score (interface confidence)',
  },
  pae_interaction: {
    label: 'iPAE',
    unit: 'Å',
    direction: 'lower',
    goodThreshold: 10,
    description: 'Interface predicted aligned error (lower = better)',
  },
  max_pae: {
    label: 'Max PAE',
    unit: 'Å',
    direction: 'lower',
    description: 'Maximum predicted aligned error',
  },
  scrmsd: {
    label: 'scRMSD',
    unit: 'Å',
    direction: 'lower',
    goodThreshold: 2.0,
    description: 'Self-consistency RMSD (designed vs. refolded backbone)',
  },
  sctm: {
    label: 'scTM',
    direction: 'higher',
    goodThreshold: 0.5,
    description: 'Self-consistency TM-score',
  },
  score: {
    label: 'MPNN Score',
    direction: 'lower',
    description: 'ProteinMPNN log-probability score (lower = better fit)',
  },
  global_score: {
    label: 'Global Score',
    direction: 'lower',
    description: 'ProteinMPNN global log-probability score',
  },
  seq_recovery: {
    label: 'Seq. Recovery',
    direction: 'higher',
    description: 'Fraction of original sequence recovered by MPNN',
  },
  ranking_confidence: {
    label: 'Rank Conf.',
    direction: 'higher',
    description: 'AlphaFold2 ranking confidence score',
  },
  confidence_score: {
    label: 'Confidence',
    direction: 'higher',
    description: 'Boltz composite confidence score',
  },
  aggregate_score: {
    label: 'Aggregate',
    direction: 'higher',
    description: 'Chai-1 aggregate confidence score',
  },
  mean_chain_iptm: {
    label: 'Chain ipTM',
    direction: 'higher',
    goodThreshold: 0.5,
    description: 'Mean per-chain interface pTM (Chai-1)',
  },
  dg: {
    label: 'ΔG',
    unit: 'REU',
    direction: 'lower',
    goodThreshold: -10,
    description: 'Rosetta binding free energy',
  },
  dg_normalized: {
    label: 'ΔG/dSASA',
    direction: 'lower',
    description: 'Binding energy normalized by buried surface area',
  },
  dsasa: {
    label: 'dSASA',
    unit: 'Å²',
    direction: 'higher',
    goodThreshold: 800,
    description: 'Buried solvent-accessible surface area at interface',
  },
  shape_complementarity: {
    label: 'Shape Comp.',
    direction: 'higher',
    goodThreshold: 0.6,
    description: 'Interface shape complementarity (0–1)',
  },
  pack_stat: {
    label: 'Pack Stat',
    direction: 'higher',
    description: 'Rosetta packing statistic',
  },
  rosetta_total: {
    label: 'Rosetta Total',
    unit: 'REU',
    direction: 'lower',
    description: 'Total Rosetta energy',
  },
  binder_energy_score: {
    label: 'Binder Energy',
    direction: 'lower',
    description: 'BindCraft binder energy score',
  },
  mpnn_score: {
    label: 'MPNN Score',
    direction: 'lower',
    description: 'ProteinMPNN sequence score',
  },
  mpnn_seq_recovery: {
    label: 'MPNN Rec.',
    direction: 'higher',
    description: 'MPNN sequence recovery',
  },
  dev_length: {
    label: 'Length',
    unit: 'aa',
    direction: 'neutral',
    description: 'Sequence length in amino acids',
  },
  dev_mw: {
    label: 'MW',
    unit: 'kDa',
    direction: 'neutral',
    description: 'Molecular weight',
  },
  dev_pi: {
    label: 'pI',
    direction: 'neutral',
    description: 'Isoelectric point',
  },
  dev_gravy: {
    label: 'GRAVY',
    direction: 'neutral',
    description: 'Grand average of hydropathy index',
  },
  dev_aromaticity: {
    label: 'Aromaticity',
    direction: 'neutral',
    description: 'Fraction of aromatic residues (F/W/Y)',
  },
  dev_instability: {
    label: 'Instability',
    direction: 'lower',
    description: 'Protein instability index (< 40 = stable)',
  },
  dev_charge_ph7: {
    label: 'Charge (pH7)',
    direction: 'neutral',
    description: 'Net charge at pH 7',
  },
  affinity_pred_value: {
    label: 'Affinity (pKd)',
    direction: 'higher',
    description: 'Boltz-2 predicted affinity (pKd)',
  },
  affinity_probability_binary: {
    label: 'Affinity Prob.',
    direction: 'higher',
    goodThreshold: 0.5,
    description: 'Boltz-2 binary affinity probability',
  },
  ipsae: {
    label: 'ipSAE',
    unit: 'Å',
    direction: 'lower',
    goodThreshold: 0.4,
    description: 'AF3 interaction score from aligned errors (lower = better interface)',
  },
  buns_hb: {
    label: 'BUnsHB',
    direction: 'lower',
    goodThreshold: 2,
    description: 'Buried unsatisfied H-bonds — each costs ~1 kcal/mol binding energy',
  },
  esm_fitness: {
    label: 'ESM Fitness',
    direction: 'higher',
    goodThreshold: -1.5,
    description: 'ESM-2 per-residue log-likelihood — proxy for sequence naturalness, stability, and expression likelihood (higher = more evolutionarily plausible sequence)',
  },
  binder_rmsd: {
    label: 'Binder RMSD',
    unit: 'Å',
    direction: 'lower',
    goodThreshold: 2.0,
    description: 'RMSD of binder backbone vs. designed pose',
  },
  target_rmsd: {
    label: 'Target RMSD',
    unit: 'Å',
    direction: 'lower',
    goodThreshold: 1.5,
    description: 'RMSD of target backbone vs. input structure',
  },
  hotspot_rmsd: {
    label: 'Hotspot RMSD',
    unit: 'Å',
    direction: 'lower',
    goodThreshold: 1.0,
    description: 'RMSD of designed hotspot residues vs. target',
  },
  n_interface_residues: {
    label: 'Interface Res.',
    direction: 'higher',
    goodThreshold: 20,
    description: 'Number of interface residues (within 8 Å of partner)',
  },
  n_hbonds: {
    label: 'H-bonds',
    direction: 'higher',
    description: 'Number of inter-chain hydrogen bonds at interface',
  },
  dg_separated: {
    label: 'ΔG sep.',
    unit: 'REU',
    direction: 'lower',
    description: 'Rosetta energy of separated chains',
  },
  dg_cross: {
    label: 'ΔG cross',
    unit: 'REU',
    direction: 'lower',
    goodThreshold: -10,
    description: 'Rosetta cross-interface binding energy',
  },
  temperature: {
    label: 'Temperature',
    direction: 'neutral',
    description: 'ProteinMPNN sampling temperature',
  },
  sample_id: {
    label: 'Sample',
    direction: 'neutral',
    description: 'ProteinMPNN sample index',
  },
  helix_percent: {
    label: '% Helix',
    direction: 'neutral',
    description: 'Fraction of residues in helical secondary structure',
  },
  beta_percent: {
    label: '% Beta',
    direction: 'neutral',
    description: 'Fraction of residues in beta-sheet secondary structure',
  },
  surface_hydrophobicity: {
    label: 'Surface Hydro.',
    direction: 'lower',
    description: 'Surface-exposed hydrophobic patch fraction (lower = more soluble)',
  },
  exp_kd: {
    label: 'KD (nM)',
    unit: 'nM',
    direction: 'lower',
    description: 'Experimental binding affinity from BLI or SPR (lower = tighter binding)',
  },
  exp_expression: {
    label: 'Expression',
    unit: '%',
    direction: 'higher',
    goodThreshold: 50,
    description: 'Measured expression rate in wet lab (higher = better)',
  },
  exp_tm: {
    label: 'Tm (°C)',
    unit: '°C',
    direction: 'higher',
    goodThreshold: 60,
    description: 'Melting temperature from DSF (higher = more stable)',
  },
  exp_binding: {
    label: 'Binds',
    direction: 'neutral',
    description: 'Whether the candidate showed measurable binding (1 = yes, 0 = no)',
  },
}

const METRIC_KEY_ALIASES: Record<string, string> = {
  i_ptm: 'iptm',
  i_pae: 'pae_interaction',
  pae: 'pae_interaction',
  interface_pae: 'pae_interaction',
  buns: 'buns_hb',
  esm_log_likelihood: 'esm_fitness',
  esm_pll: 'esm_fitness',
}

export function normalizeMetricKey(key: string): string {
  const lower = key.toLowerCase()
  return METRIC_KEY_ALIASES[lower] ?? lower
}

export function getMetricMeta(key: string): MetricMeta | null {
  const normalized = normalizeMetricKey(key)
  return METRIC_REGISTRY[normalized] ?? METRIC_REGISTRY[key] ?? null
}

export function getMetricLabel(key: string): string {
  return getMetricMeta(key)?.label ?? formatFallbackLabel(key)
}

export function getMetricDirection(key: string): 'higher' | 'lower' | 'neutral' {
  return getMetricMeta(key)?.direction ?? 'neutral'
}

export function getMetricGoodThreshold(key: string, sampleValue?: number): number | undefined {
  const meta = getMetricMeta(key)
  if (!meta) return undefined
  if (meta.goodThresholdScale100 !== undefined && sampleValue !== undefined && sampleValue > 2) {
    return meta.goodThresholdScale100
  }
  return meta.goodThreshold
}

export function isAboveGoodThreshold(key: string, value: number): boolean | null {
  const threshold = getMetricGoodThreshold(key, value)
  if (threshold === undefined) return null
  const direction = getMetricDirection(key)
  if (direction === 'higher') return value >= threshold
  if (direction === 'lower') return value <= threshold
  return null
}

function formatFallbackLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}
