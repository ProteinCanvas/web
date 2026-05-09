import type { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context'
import type { RepresentationType, ColorScheme, StructureFormat, ResidueRef } from '@/shared/types'
import type { Subscription } from 'rxjs'
import type { Loci as StructureElementLoci } from 'molstar/lib/mol-model/structure/structure/element/loci'
import { OrderedSet } from 'molstar/lib/mol-data/int'
import { Unit } from 'molstar/lib/mol-model/structure/structure/unit'
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder'
import { StructureSelectionQuery } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query'

type CameraSnapshot = unknown

export class MolstarBridge {
  private plugin: PluginUIContext | null = null
  private selectionCallback: ((residues: string[]) => void) | null = null
  private clickSub: Subscription | null = null
  private cameraRAF: number | null = null
  private lastCameraPos = ''
  private isSyncingCamera = false

  async init(container: HTMLElement): Promise<void> {
    const { createPluginUI } = await import('molstar/lib/mol-plugin-ui')
    const { renderReact18 } = await import('molstar/lib/mol-plugin-ui/react18')
    const { DefaultPluginUISpec } = await import('molstar/lib/mol-plugin-ui/spec')

    const plugin = await createPluginUI({
      target: container,
      render: renderReact18,
      spec: {
        ...DefaultPluginUISpec(),
        layout: {
          initial: {
            isExpanded: false,
            showControls: false,
          },
        },
        components: {
          ...DefaultPluginUISpec().components,
          hideTaskOverlay: true,
        },
      },
    })

    this.plugin = plugin
    this.applyCurrentBackground()
    this.subscribeToClicks()
  }

  setBackground(isDark: boolean): void {
    this.plugin?.canvas3d?.setProps({
      renderer: {
        backgroundColor: (isDark ? 0x1a1a1a : 0xf5f5f5) as import('molstar/lib/mol-util/color').Color,
      },
    })
  }

  private applyCurrentBackground(): void {
    const isDark = document.documentElement.classList.contains('dark')
    this.setBackground(isDark)
  }

  destroy(): void {
    this.stopCameraTracking()
    this.clickSub?.unsubscribe()
    this.clickSub = null
    this.plugin?.dispose()
    this.plugin = null
  }

  private subscribeToClicks(): void {
    if (!this.plugin) return

    this.clickSub = this.plugin.behaviors.interaction.click.subscribe(async (event) => {
      if (!this.selectionCallback) return

      const { current } = event
      if (!current?.loci) return

      const lociKind = (current.loci as { kind?: string }).kind
      if (lociKind !== 'element-loci') return

      const loci = current.loci as StructureElementLoci
      const residueSet = new Set<string>()

      for (const { unit, indices } of loci.elements) {
        if (!Unit.isAtomic(unit)) continue

        const hierarchy = unit.model.atomicHierarchy
        const size = OrderedSet.size(indices)

        for (let i = 0; i < size; i++) {
          const unitIdx = OrderedSet.getAt(indices, i)
          const elementIndex = unit.elements[unitIdx]
          const residueIndex = unit.residueIndex[elementIndex]
          const chainIndex = unit.chainIndex[elementIndex]
          const seqId = hierarchy.residues.auth_seq_id.value(residueIndex)
          const chainId = hierarchy.chains.auth_asym_id.value(chainIndex)
          residueSet.add(`${chainId}:${seqId}`)
        }
      }

      this.selectionCallback(Array.from(residueSet))
    })
  }

  startCameraTracking(callback: (snapshot: CameraSnapshot) => void): void {
    const track = () => {
      const cam = (this.plugin?.canvas3d as unknown as { camera?: { snapshot: CameraSnapshot } })?.camera
      if (cam) {
        const pos = JSON.stringify((cam.snapshot as { position?: unknown })?.position)
        if (pos !== this.lastCameraPos) {
          this.lastCameraPos = pos
          if (!this.isSyncingCamera) callback(cam.snapshot)
        }
      }
      this.cameraRAF = requestAnimationFrame(track)
    }
    this.cameraRAF = requestAnimationFrame(track)
  }

  stopCameraTracking(): void {
    if (this.cameraRAF !== null) {
      cancelAnimationFrame(this.cameraRAF)
      this.cameraRAF = null
    }
  }

  applyCameraSnapshot(snapshot: CameraSnapshot): void {
    if (!this.plugin?.canvas3d || !snapshot) return
    this.isSyncingCamera = true
    try {
      const cam = (this.plugin.canvas3d as unknown as {
        camera?: { setState: (s: CameraSnapshot) => void }
        requestRedraw?: () => void
      })
      cam.camera?.setState(snapshot)
      cam.requestRedraw?.()
    } catch {}
    setTimeout(() => { this.isSyncingCamera = false }, 50)
  }

  async loadFromPdbId(pdbId: string): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    await plugin.clear()
    this.applyCurrentBackground()

    const data = await plugin.builders.data.download({
      url: `https://models.rcsb.org/${pdbId.toLowerCase()}.bcif`,
      isBinary: true,
    })
    const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif')
    await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')
  }

  async loadFromData(data: string, format: StructureFormat): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    await plugin.clear()
    this.applyCurrentBackground()

    const molFormat = format === 'pdb' ? 'pdb' : 'mmcif'
    const rawData = await plugin.builders.data.rawData({ data })
    const trajectory = await plugin.builders.structure.parseTrajectory(rawData, molFormat)
    await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')
  }

  async loadFromUrl(url: string, format: StructureFormat): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    await plugin.clear()
    this.applyCurrentBackground()

    const isBinary = format !== 'pdb'
    const molFormat = format === 'pdb' ? 'pdb' : 'mmcif'
    const data = await plugin.builders.data.download({ url, isBinary })
    const trajectory = await plugin.builders.structure.parseTrajectory(data, molFormat)
    await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')
  }

  async loadFromSequence(sequence: string): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    await plugin.clear()
    this.applyCurrentBackground()

    const response = await fetch('https://api.esmatlas.com/foldSequence/v1/pdb/', {
      method: 'POST',
      body: sequence,
    })

    if (!response.ok) throw new Error('ESMFold prediction failed')

    const pdbString = await response.text()
    const rawData = await plugin.builders.data.rawData({ data: pdbString })
    const trajectory = await plugin.builders.structure.parseTrajectory(rawData, 'pdb')
    await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')
  }

  async clearStructure(): Promise<void> {
    await this.plugin?.clear()
    this.applyCurrentBackground()
  }

  async loadTargetStructure(data: string, format: StructureFormat): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return
    const molFormat = format === 'pdb' ? 'pdb' : 'mmcif'
    const rawData = await plugin.builders.data.rawData({ data, label: '__target__' })
    const trajectory = await plugin.builders.structure.parseTrajectory(rawData, molFormat)
    await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default')
    const structures = plugin.managers.structure.hierarchy.current.structures
    const last = structures[structures.length - 1]
    if (last) {
      await plugin.dataTransaction(async () => {
        await plugin.managers.structure.component.updateRepresentationsTheme(last.components, {
          color: 'chain-id' as import('molstar/lib/mol-theme/color').ColorTheme.BuiltIn,
        })
        for (const comp of last.components) {
          await plugin.builders.structure.representation.addRepresentation(comp.cell, {
            type: 'molecular-surface' as import('molstar/lib/mol-repr/structure/registry').StructureRepresentationRegistry.BuiltIn,
            typeParams: { alpha: 0.3 } as never,
            color: 'uniform' as import('molstar/lib/mol-theme/color').ColorTheme.BuiltIn,
            colorParams: { value: 0x888888 as import('molstar/lib/mol-util/color').Color },
          })
        }
      })
    }
  }

  async highlightHotspotResidues(residues: ResidueRef[]): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    const structures = plugin.managers.structure.hierarchy.current.structures
    for (const s of structures) {
      const label = (s.cell.obj?.data as { label?: string } | undefined)?.label
      if (label !== '__target__') continue

      for (const comp of s.components) {
        const compLabel = (comp.cell.obj?.label ?? '') as string
        if (compLabel === '__hotspot__') {
          await plugin.build().delete(comp.cell).commit()
        }
      }
    }

    if (residues.length === 0) return

    const expressions = residues.map(({ chainId, residueIndex }) =>
      MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
        'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), residueIndex]),
      })
    )

    const expression =
      expressions.length === 1
        ? expressions[0]
        : MS.struct.combinator.merge(expressions)

    const query = StructureSelectionQuery('Hotspot Residues', expression)

    const updatedStructures = plugin.managers.structure.hierarchy.current.structures
    for (const s of updatedStructures) {
      const sLabel = (s.cell.obj?.data as { label?: string } | undefined)?.label
      if (sLabel !== '__target__') continue

      await plugin.managers.structure.component.add(
        {
          selection: query,
          options: { checkExisting: false, label: '__hotspot__' },
          representation: 'ball-and-stick',
        },
        [s]
      )

      const refreshed = plugin.managers.structure.hierarchy.current.structures
      const target = refreshed.find(
        (x) => (x.cell.obj?.data as { label?: string } | undefined)?.label === '__target__'
      )
      if (!target) continue

      const hotspotComp = target.components.find(
        (c) => (c.cell.obj?.label ?? '') === '__hotspot__'
      )
      if (hotspotComp) {
        await plugin.managers.structure.component.updateRepresentationsTheme(
          [hotspotComp],
          {
            color: 'uniform' as import('molstar/lib/mol-theme/color').ColorTheme.BuiltIn,
            colorParams: { value: 0xff8c00 as import('molstar/lib/mol-util/color').Color },
          }
        )
      }
    }
  }

  async clearTargetStructure(): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return
    const refs = plugin.managers.structure.hierarchy.current.structures
    for (const s of refs) {
      const label = (s.cell.obj?.data as { label?: string } | undefined)?.label
      if (label === '__target__') {
        await plugin.build().delete(s.cell).commit()
      }
    }
  }

  async exportPng(opts?: {
    background?: 'white' | 'black' | 'transparent'
    targetWidth?: number
    targetHeight?: number
  }): Promise<string | null> {
    const plugin = this.plugin
    if (!plugin) return null

    const background = opts?.background ?? 'white'
    const bgColor = background === 'white' ? 0xffffff : background === 'black' ? 0x000000 : null

    if (bgColor !== null) {
      plugin.canvas3d?.setProps({
        renderer: { backgroundColor: bgColor as import('molstar/lib/mol-util/color').Color },
      })
    }

    const helper = plugin.helpers.viewportScreenshot
    let resultUrl: string | null = null

    if (helper) {
      try {
        resultUrl = await helper.getImageDataUri()
      } catch {}
    }

    const targetW = opts?.targetWidth
    if (resultUrl && targetW) {
      const raw = resultUrl
      const targetH = opts?.targetHeight
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => resolve(null)
        i.src = raw
      })
      if (img) {
        const th = targetH ?? Math.round((targetW * img.height) / img.width)
        const off = document.createElement('canvas')
        off.width = targetW
        off.height = th
        const ctx = off.getContext('2d')
        if (ctx) {
          if (bgColor !== null) {
            ctx.fillStyle = background === 'white' ? '#ffffff' : '#000000'
            ctx.fillRect(0, 0, targetW, th)
          }
          ctx.drawImage(img, 0, 0, targetW, th)
          resultUrl = off.toDataURL('image/png')
        }
      }
    }

    this.applyCurrentBackground()

    return resultUrl
  }

  setSelectedResidues(residues: string[]): void {
    const plugin = this.plugin
    if (!plugin) return

    if (residues.length === 0) {
      plugin.managers.structure.selection.clear()
      return
    }

    this.applyResidueSelection(plugin, residues).catch(console.error)
  }

  private async applyResidueSelection(plugin: PluginUIContext, residues: string[]): Promise<void> {
    const parsed = residues.flatMap((r) => {
      const colonIdx = r.indexOf(':')
      if (colonIdx === -1) return []
      const chainId = r.slice(0, colonIdx)
      const seqId = parseInt(r.slice(colonIdx + 1), 10)
      if (isNaN(seqId)) return []
      return [{ chainId, seqId }]
    })

    if (parsed.length === 0) return

    const expressions = parsed.map(({ chainId, seqId }) =>
      MS.struct.generator.atomGroups({
        'chain-test': MS.core.rel.eq([MS.ammp('auth_asym_id'), chainId]),
        'residue-test': MS.core.rel.eq([MS.ammp('auth_seq_id'), seqId]),
      })
    )

    const expression =
      expressions.length === 1
        ? expressions[0]
        : MS.struct.combinator.merge(expressions)

    const query = StructureSelectionQuery('Selected Residues', expression)
    plugin.managers.structure.selection.fromSelectionQuery('set', query)
  }

  onSelectionChange(callback: (residues: string[]) => void): void {
    this.selectionCallback = callback
  }

  async setRepresentationType(type: RepresentationType): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    const molType = type === 'ball-and-stick' ? 'ball-and-stick' : type
    const structures = plugin.managers.structure.hierarchy.current.structures

    await plugin.dataTransaction(async () => {
      for (const s of structures) {
        await plugin.managers.structure.component.removeRepresentations(s.components)
        await plugin.managers.structure.component.addRepresentation(s.components, molType)
      }
    })
  }

  async setColorScheme(scheme: ColorScheme): Promise<void> {
    const plugin = this.plugin
    if (!plugin) return

    type BuiltInColor = import('molstar/lib/mol-theme/color').ColorTheme.BuiltIn

    const colorMap: Record<ColorScheme, BuiltInColor> = {
      plddt: 'uncertainty',
      chain: 'chain-id',
      element: 'element-symbol',
      'residue-index': 'sequence-id',
      conservation: 'sequence-id',
    }

    const color = colorMap[scheme]
    const structures = plugin.managers.structure.hierarchy.current.structures

    await plugin.dataTransaction(async () => {
      for (const s of structures) {
        await plugin.managers.structure.component.updateRepresentationsTheme(s.components, {
          color,
        })
      }
    })
  }
}
