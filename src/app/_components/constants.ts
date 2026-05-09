export type CenterTab =
  | 'summary'
  | 'candidates'
  | 'analytics'
  | 'umap'
  | 'filters'
  | 'experiments'

export type RightTab = 'structure' | 'sequence' | 'compare' | 'pae'
export type LeftTab = 'campaigns' | 'shortlist'

export const SOURCE_LABELS: Record<string, string> = {
  rfdiffusion: 'RFdiffusion',
  proteinmpnn: 'ProteinMPNN',
  boltzgen: 'BoltzGen',
  boltz1: 'Boltz-1',
  bindcraft: 'BindCraft',
  alphafold2: 'AlphaFold2',
  alphafold3: 'AlphaFold3',
  chai1: 'Chai-1',
  colabfold: 'ColabFold',
  esmfold: 'ESMFold',
  esm3: 'ESM3',
  ligandmpnn: 'LigandMPNN',
  rosetta: 'Rosetta',
  diffab: 'DiffAb',
  generic: 'CSV',
  bundle: 'Bundle',
}
