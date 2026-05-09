export type CenterTab = 'candidates' | 'analytics' | 'umap' | 'funnel' | 'constraints' | 'comparison' | 'summary'
export type RightTab = 'structure' | 'sequence' | 'compare' | 'pae'
export type LeftTab = 'campaigns' | 'shortlist'

export const SOURCE_LABELS: Record<string, string> = {
  rfdiffusion: 'RFdiffusion',
  proteinmpnn: 'ProteinMPNN',
  boltzgen: 'BoltzGen',
  bindcraft: 'BindCraft',
  alphafold2: 'AlphaFold2',
  alphafold3: 'AlphaFold3',
  chai1: 'Chai-1',
  colabfold: 'ColabFold',
  esmfold: 'ESMFold',
  ligandmpnn: 'LigandMPNN',
  rosetta: 'Rosetta',
  generic: 'CSV',
  bundle: 'Bundle',
}
