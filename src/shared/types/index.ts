export type StructureFormat = 'pdb' | 'cif' | 'mmcif'

export type CampaignSource =
  | 'rfdiffusion'
  | 'proteinmpnn'
  | 'boltzgen'
  | 'boltz1'
  | 'bindcraft'
  | 'alphafold2'
  | 'alphafold3'
  | 'chai1'
  | 'colabfold'
  | 'esmfold'
  | 'esm3'
  | 'ligandmpnn'
  | 'rosetta'
  | 'diffab'
  | 'generic'
  | 'bundle'

export type RepresentationType = 'cartoon' | 'surface' | 'ball-and-stick'

export type ColorScheme = 'plddt' | 'chain' | 'element' | 'residue-index' | 'conservation'

export type MetricType = 'number' | 'string' | 'boolean'

export type ProvenanceNodeType =
  | 'import'
  | 'filter'
  | 'generate'
  | 'score'
  | 'shortlist'
  | 'export'

export type ShortlistStatus = 'candidate' | 'priority' | 'approved' | 'rejected'

export type AdapterName =
  | 'rfdiffusion'
  | 'proteinmpnn'
  | 'boltzgen'
  | 'boltz1'
  | 'bindcraft'
  | 'alphafold2'
  | 'alphafold3'
  | 'chai1'
  | 'colabfold'
  | 'esmfold'
  | 'esm3'
  | 'ligandmpnn'
  | 'rosetta'
  | 'diffab'
  | 'generic-csv'
  | 'bundle'

export interface TargetProtein {
  name: string
  structureData: string
  structureFormat: StructureFormat
  hotspotResidues?: ResidueRef[]
}

export interface ExperimentalResult {
  candidateId: string
  round: number
  kd?: number
  expressionRate?: number
  tm?: number
  bindingSuccess?: boolean
  synthesized?: boolean
  expressed?: boolean
  kon?: number
  koff?: number
  customMetrics: Record<string, number>
  metadata: Record<string, unknown>
}

export interface DesignRound {
  id: string
  roundNumber: number
  label: string
  createdAt: string
  orderedCandidateIds: string[]
  rationale?: string
  strategy?: 'diversity' | 'optimization' | 'combination' | 'validation'
}

export interface ResidueRef {
  chainId: string
  residueIndex: number
  residueName?: string
  insertionCode?: string
}

export interface ResidueRange {
  chainId: string
  startIndex: number
  endIndex: number
}

export interface Candidate {
  id: string
  name: string
  sequence?: string
  pdbId?: string
  structureData?: string
  structureFormat?: StructureFormat
  metrics: Record<string, number | string | boolean>
  metadata: Record<string, unknown>
  source?: CampaignSource
  parentId?: string
  embedding?: number[]
  paeMatrix?: number[][]
  plddtPerResidue?: number[]
}

export interface MetricField {
  key: string
  label: string
  type: MetricType
  min?: number
  max?: number
  unit?: string
}

export interface ProvenanceNode {
  id: string
  type: ProvenanceNodeType
  label: string
  timestamp: string
  parameters: Record<string, unknown>
  inputIds: string[]
  outputIds: string[]
  candidateCount?: number
}

export interface Campaign {
  id: string
  name: string
  source: CampaignSource
  createdAt: string
  candidates: Candidate[]
  metricFields: MetricField[]
  provenanceNodes: ProvenanceNode[]
  metadata: Record<string, unknown>
  target?: TargetProtein
  experimentalResults?: ExperimentalResult[]
  rounds?: DesignRound[]
}

export interface ShortlistEntry {
  candidateId: string
  campaignId: string
  addedAt: string
  status: ShortlistStatus
  notes: string
}

export interface ConstraintSpec {
  hotspots: ResidueRef[]
  masks: ResidueRange[]
  locks: ResidueRef[]
  motifs: { sourcePdb: string; residues: ResidueRange[] }[]
  partialDiffusion?: {
    startT: number
    residues: ResidueRange[]
  }
}

export interface FilterState {
  metricFilters: Record<string, { min?: number; max?: number }>
  searchQuery: string
  showShortlistOnly: boolean
}

export interface MetricFilter {
  key: string
  min?: number
  max?: number
}

export interface CampaignAdapter {
  name: AdapterName
  label: string
  accepts: (files: File[]) => boolean
  parse: (files: File[]) => Promise<Omit<Campaign, 'id' | 'createdAt'>>
}
