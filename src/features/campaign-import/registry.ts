import type { CampaignAdapter } from '@/shared/types'
import { rfdiffusionAdapter } from './adapters/rfdiffusion'
import { proteinmpnnAdapter } from './adapters/proteinmpnn'
import { boltzgenAdapter } from './adapters/boltzgen'
import { bindcraftAdapter } from './adapters/bindcraft'
import { alphafold2Adapter } from './adapters/alphafold2'
import { alphafold3Adapter } from './adapters/alphafold3'
import { chai1Adapter } from './adapters/chai1'
import { colabfoldAdapter } from './adapters/colabfold'
import { esmfoldAdapter } from './adapters/esmfold'
import { ligandmpnnAdapter } from './adapters/ligandmpnn'
import { rosettaAdapter } from './adapters/rosetta'
import { genericCsvAdapter } from './adapters/generic'

export const adapterRegistry: CampaignAdapter[] = [
  bindcraftAdapter,
  chai1Adapter,
  alphafold3Adapter,
  colabfoldAdapter,
  alphafold2Adapter,
  boltzgenAdapter,
  rosettaAdapter,
  rfdiffusionAdapter,
  ligandmpnnAdapter,
  proteinmpnnAdapter,
  esmfoldAdapter,
  genericCsvAdapter,
]

export function detectAdapter(files: File[]): CampaignAdapter | null {
  return adapterRegistry.find((a) => a.accepts(files)) ?? null
}
