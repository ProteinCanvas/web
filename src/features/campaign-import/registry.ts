import type { CampaignAdapter } from '@/shared/types'
import { rfdiffusionAdapter } from './adapters/rfdiffusion'
import { proteinmpnnAdapter } from './adapters/proteinmpnn'
import { boltzgenAdapter } from './adapters/boltzgen'
import { boltz1Adapter } from './adapters/boltz1'
import { bindcraftAdapter } from './adapters/bindcraft'
import { alphafold2Adapter } from './adapters/alphafold2'
import { alphafold3Adapter } from './adapters/alphafold3'
import { chai1Adapter } from './adapters/chai1'
import { colabfoldAdapter } from './adapters/colabfold'
import { esmfoldAdapter } from './adapters/esmfold'
import { esm3Adapter } from './adapters/esm3'
import { ligandmpnnAdapter } from './adapters/ligandmpnn'
import { rosettaAdapter } from './adapters/rosetta'
import { diffabAdapter } from './adapters/diffab'
import { genericCsvAdapter } from './adapters/generic'

export const adapterRegistry: CampaignAdapter[] = [
  bindcraftAdapter,
  chai1Adapter,
  alphafold3Adapter,
  colabfoldAdapter,
  alphafold2Adapter,
  boltz1Adapter,
  boltzgenAdapter,
  diffabAdapter,
  rosettaAdapter,
  rfdiffusionAdapter,
  ligandmpnnAdapter,
  proteinmpnnAdapter,
  esm3Adapter,
  esmfoldAdapter,
  genericCsvAdapter,
]

export function detectAdapter(files: File[]): CampaignAdapter | null {
  return adapterRegistry.find((a) => a.accepts(files)) ?? null
}
