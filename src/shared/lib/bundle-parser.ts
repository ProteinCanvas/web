import JSZip from 'jszip'
import type { Campaign, Candidate, ProvenanceNode } from '@/shared/types'
import { nanoid } from '@/shared/lib/nanoid'
import { inferMetricFields } from '@/shared/lib/metrics'

interface BundleManifest {
  schema_version: string
  name: string
  source: string
  created_at: string
  candidate_count: number
  metadata?: Record<string, unknown>
}

export async function parseCampaignBundle(file: File): Promise<Campaign> {
  const zip = await JSZip.loadAsync(file)

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('Invalid bundle: missing manifest.json')

  const manifest: BundleManifest = JSON.parse(await manifestFile.async('string'))

  const candidatesFile = zip.file('candidates.json')
  if (!candidatesFile) throw new Error('Invalid bundle: missing candidates.json')

  const candidates: Candidate[] = JSON.parse(await candidatesFile.async('string'))

  const structureDir = zip.folder('structures')
  if (structureDir) {
    const structureFiles = new Map<string, JSZip.JSZipObject>()
    structureDir.forEach((relativePath, file) => {
      structureFiles.set(relativePath.toLowerCase(), file)
    })

    for (const candidate of candidates) {
      const idLower = candidate.id.toLowerCase()
      const entry =
        structureFiles.get(`${idLower}.pdb`) ||
        structureFiles.get(`${idLower}.cif`) ||
        structureFiles.get(`${idLower}.mmcif`)

      if (entry) {
        candidate.structureData = await entry.async('string')
        const name = entry.name.toLowerCase()
        candidate.structureFormat = name.endsWith('.pdb')
          ? 'pdb'
          : name.endsWith('.mmcif')
          ? 'mmcif'
          : 'cif'
      }
    }
  }

  let provenanceNodes: ProvenanceNode[] = []
  const provenanceFile = zip.file('provenance.json')
  if (provenanceFile) {
    provenanceNodes = JSON.parse(await provenanceFile.async('string'))
  }

  return {
    id: nanoid(),
    name: manifest.name,
    source: 'bundle',
    createdAt: manifest.created_at ?? new Date().toISOString(),
    candidates,
    metricFields: inferMetricFields(candidates),
    provenanceNodes,
    metadata: manifest.metadata ?? {},
  }
}

export async function exportCampaignBundle(
  campaign: Campaign,
  shortlistedIds: Set<string>
): Promise<Blob> {
  const zip = new JSZip()

  const shortlisted = campaign.candidates.filter((c) => shortlistedIds.has(c.id))

  const manifest: BundleManifest = {
    schema_version: '1.0',
    name: campaign.name,
    source: campaign.source,
    created_at: campaign.createdAt,
    candidate_count: shortlisted.length,
    metadata: campaign.metadata,
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  const strippedCandidates = shortlisted.map(({ structureData: _, ...c }) => c)
  zip.file('candidates.json', JSON.stringify(strippedCandidates, null, 2))

  const structures = zip.folder('structures')
  if (structures) {
    for (const candidate of shortlisted) {
      if (candidate.structureData) {
        const ext = candidate.structureFormat ?? 'pdb'
        structures.file(`${candidate.id}.${ext}`, candidate.structureData)
      }
    }
  }

  if (campaign.provenanceNodes.length > 0) {
    zip.file('provenance.json', JSON.stringify(campaign.provenanceNodes, null, 2))
  }

  const fasta = shortlisted
    .filter((c) => c.sequence)
    .map((c) => `>${c.id} ${c.name}\n${c.sequence}`)
    .join('\n')

  if (fasta) {
    zip.file('shortlist.fasta', fasta)
  }

  return zip.generateAsync({ type: 'blob' })
}
