export interface MetricTooltip {
  description: string
  direction: 'higher-better' | 'lower-better' | 'neutral'
  typical_good: string
  reference: string
}

export const METRIC_TOOLTIPS: Record<string, MetricTooltip> = {
  plddt: {
    description: 'Per-residue confidence score from AlphaFold/ESMFold. Measures structural prediction confidence.',
    direction: 'higher-better',
    typical_good: '> 0.80',
    reference: 'Jumper et al., Nature 2021',
  },
  iptm: {
    description: 'Interface predicted TM-score. Measures confidence in the predicted binding interface.',
    direction: 'higher-better',
    typical_good: '> 0.70',
    reference: 'Evans et al., Science 2022',
  },
  pae_interaction: {
    description: 'Predicted aligned error across the binder–target interface. Lower values indicate higher-confidence interface prediction.',
    direction: 'lower-better',
    typical_good: '< 10 Å',
    reference: 'Evans et al., Science 2022',
  },
  ptm: {
    description: 'Predicted TM-score. Overall structural confidence across the full complex.',
    direction: 'higher-better',
    typical_good: '> 0.70',
    reference: 'Jumper et al., Nature 2021',
  },
  scrmsd: {
    description: 'Self-consistency RMSD. Backbone RMSD between designed structure and AF2 re-prediction of the designed sequence. Measures design self-consistency.',
    direction: 'lower-better',
    typical_good: '< 2.0 Å',
    reference: 'Watson et al., Nature 2023',
  },
  seq_recovery: {
    description: 'Sequence recovery. Fraction of residues recovered by ProteinMPNN matching the original backbone design.',
    direction: 'higher-better',
    typical_good: '> 0.30',
    reference: 'Dauparas et al., Science 2022',
  },
  composite_score: {
    description: 'Composite quality score combining iPTM (40%), normalized iPAE (30%), and normalized scRMSD (30%). Higher = better overall quality.',
    direction: 'higher-better',
    typical_good: '> 0.65',
    reference: 'ProteinCanvas computed metric',
  },
  dev_pi: {
    description: 'Isoelectric point. pH at which the protein carries no net electrical charge. Extreme values (< 4.5 or > 10.5) indicate potential solubility issues.',
    direction: 'neutral',
    typical_good: '5.0 – 9.0',
    reference: 'Grimsley et al., Protein Science 2009',
  },
  dev_gravy: {
    description: 'Grand Average of Hydropathicity (Kyte-Doolittle scale). Positive values indicate hydrophobic sequences that may aggregate.',
    direction: 'lower-better',
    typical_good: '< 0.0',
    reference: 'Kyte & Doolittle, JMB 1982',
  },
  dev_instability: {
    description: 'Instability index (Guruprasad). Values > 40 predict an unstable protein in vitro.',
    direction: 'lower-better',
    typical_good: '< 40',
    reference: 'Guruprasad et al., Protein Engineering 1990',
  },
  dev_mw: {
    description: 'Molecular weight in kDa.',
    direction: 'neutral',
    typical_good: '3 – 15 kDa for mini-binders',
    reference: 'Computed from sequence',
  },
  num_hotspot_contacts: {
    description: 'Number of target hotspot residues contacted by the designed binder in the predicted complex.',
    direction: 'higher-better',
    typical_good: '≥ 5',
    reference: 'Watson et al., Nature 2023',
  },
}
