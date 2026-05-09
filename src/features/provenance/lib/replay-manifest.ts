import { nanoid } from '@/shared/lib/nanoid'
import type { Campaign, ProvenanceNode } from '@/shared/types'

export function buildReplayManifest(campaign: Campaign, shortlistedIds: string[]): object {
  const shortlistedCandidates = campaign.candidates
    .filter((c) => shortlistedIds.includes(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      sequence: c.sequence,
      metrics: c.metrics,
    }))

  return {
    schema_version: '1.0',
    tool: 'ProteinCanvas',
    parameters: campaign.metadata,
    filter_sequence: campaign.provenanceNodes
      .filter((n) => n.type === 'filter')
      .map((n) => n.parameters),
    shortlist: shortlistedCandidates,
  }
}

export function buildProvenanceImportNode(
  campaignName: string,
  candidateCount: number,
  adapterName: string
): ProvenanceNode {
  return {
    id: nanoid(),
    type: 'import',
    label: `Import: ${campaignName}`,
    timestamp: new Date().toISOString(),
    parameters: { adapter: adapterName, campaignName },
    inputIds: [],
    outputIds: [],
    candidateCount,
  }
}

export function buildProvenanceFilterNode(
  filterDescription: string,
  inputCount: number,
  outputCount: number
): ProvenanceNode {
  return {
    id: nanoid(),
    type: 'filter',
    label: `Filter: ${filterDescription}`,
    timestamp: new Date().toISOString(),
    parameters: { description: filterDescription },
    inputIds: [],
    outputIds: [],
    candidateCount: outputCount,
  }
}

export function buildProvenanceShortlistNode(candidateIds: string[]): ProvenanceNode {
  return {
    id: nanoid(),
    type: 'shortlist',
    label: `Shortlist (${candidateIds.length})`,
    timestamp: new Date().toISOString(),
    parameters: { candidateIds },
    inputIds: [],
    outputIds: [],
    candidateCount: candidateIds.length,
  }
}
