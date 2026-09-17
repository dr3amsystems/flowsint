import {
  Download,
  ExternalLink,
  Focus,
  Minus,
  Network,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Route,
  Search,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { GraphEdge, GraphNode, GraphViewerRef } from '@/types/graph'
import { adaptAgenticVaultGraph } from './graph-adapter'
import type {
  AgenticVaultGraphDocument,
  AgenticVaultGraphLink,
  AgenticVaultLifecycle
} from './types'
import { filterSecurityGraph, findSecurityGraphPath } from './workbench-model'
import styles from './security-graph-workbench.module.css'

type AgenticVaultMetadata = {
  agenticvault?: {
    lifecycle?: AgenticVaultLifecycle
    evidence?: unknown[]
    links?: AgenticVaultGraphLink[]
    product?: string
    generated_at?: string
  }
}

export type SecurityGraphWorkbenchProps = {
  document: AgenticVaultGraphDocument
  height?: number | string
  onNavigate?: (link: AgenticVaultGraphLink, node: GraphNode) => void
  onSelectionChange?: (node: GraphNode | null) => void
  className?: string
}

const nodeShapePath = (node: GraphNode, radius: number): Path2D => {
  const path = new Path2D()
  if (node.nodeShape === 'square') {
    path.rect((node.x ?? 0) - radius, (node.y ?? 0) - radius, radius * 2, radius * 2)
  } else if (node.nodeShape === 'triangle') {
    path.moveTo(node.x ?? 0, (node.y ?? 0) - radius)
    path.lineTo((node.x ?? 0) + radius, (node.y ?? 0) + radius)
    path.lineTo((node.x ?? 0) - radius, (node.y ?? 0) + radius)
    path.closePath()
  } else if (node.nodeShape === 'hexagon') {
    for (let index = 0; index < 6; index += 1) {
      const angle = (Math.PI / 3) * index
      const x = (node.x ?? 0) + radius * Math.cos(angle)
      const y = (node.y ?? 0) + radius * Math.sin(angle)
      if (index === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    }
    path.closePath()
  } else {
    path.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2)
  }
  return path
}

const downloadBlob = (contents: BlobPart, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const anchor = window.document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const SecurityGraphWorkbenchView = ({
  document,
  height = 'min(78vh, 860px)',
  onNavigate,
  onSelectionChange,
  className
}: SecurityGraphWorkbenchProps) => {
  const graph = useMemo(() => adaptAgenticVaultGraph(document), [document])
  const graphRef = useRef<GraphViewerRef>(undefined)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [query, setQuery] = useState('')
  const nodeTypes = useMemo(
    () => [...new Set(graph.nodes.map((node) => node.nodeType))].sort(),
    [graph.nodes]
  )
  const [disabledTypes, setDisabledTypes] = useState<Set<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string | null>(graph.focusId ?? null)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [pathMode, setPathMode] = useState(false)
  const [pathEndpoints, setPathEndpoints] = useState<string[]>([])

  const enabledTypes = useMemo(
    () => new Set(nodeTypes.filter((nodeType) => !disabledTypes.has(nodeType))),
    [disabledTypes, nodeTypes]
  )

  useEffect(() => {
    const container = graphContainerRef.current
    if (!container) return
    const update = () => {
      const rect = container.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const activeElement = window.document.activeElement
      const isEditing =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      if (event.key === '/' && !isEditing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setSelectedId(null)
        setPathEndpoints([])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const filtered = useMemo(
    () => filterSecurityGraph(graph.nodes, graph.edges, query, enabledTypes),
    [enabledTypes, graph.edges, graph.nodes, query]
  )

  const path = useMemo(
    () =>
      pathEndpoints.length === 2
        ? findSecurityGraphPath(filtered.edges, pathEndpoints[0], pathEndpoints[1])
        : null,
    [filtered.edges, pathEndpoints]
  )
  const pathNodeIds = useMemo(() => new Set(path?.nodeIds ?? []), [path])
  const pathEdgeIds = useMemo(() => new Set(path?.edgeIds ?? []), [path])
  const selectedNode = graph.nodes.find((node) => node.id === selectedId) ?? null
  const metadata = selectedNode?.nodeMetadata as AgenticVaultMetadata | undefined

  useEffect(() => onSelectionChange?.(selectedNode), [onSelectionChange, selectedNode])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedId(node.id)
      setDetailsOpen(true)
      if (pathMode) {
        setPathEndpoints((current) => (current.length >= 2 ? [node.id] : [...current, node.id]))
      }
    },
    [pathMode]
  )

  const renderNode = useCallback(
    (node: GraphNode, context: CanvasRenderingContext2D, scale: number) => {
      const radius = Math.max(5, node.nodeSize / Math.sqrt(Math.max(scale, 0.5)))
      const selected = node.id === selectedId
      const inPath = pathNodeIds.has(node.id)
      const shape = nodeShapePath(node, radius)
      context.save()
      context.shadowColor = selected || inPath ? '#18C7B5' : 'transparent'
      context.shadowBlur = selected || inPath ? 16 : 0
      context.fillStyle = node.nodeColor ?? '#7C8DA6'
      context.fill(shape)
      context.lineWidth = selected ? 3 / scale : 1.5 / scale
      context.strokeStyle = selected || inPath ? '#D9FFFA' : '#080B10'
      context.stroke(shape)
      if (scale > 0.75 || selected) {
        context.font = `${selected ? 600 : 500} ${Math.max(9, 11 / scale)}px Inter, sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'top'
        context.fillStyle = '#E8EDF5'
        context.fillText(
          node.nodeLabel,
          node.x ?? 0,
          (node.y ?? 0) + radius + 5 / scale,
          190 / scale
        )
      }
      context.restore()
    },
    [pathNodeIds, selectedId]
  )

  const toggleType = (nodeType: string) => {
    setDisabledTypes((current) => {
      const next = new Set(current)
      if (next.has(nodeType)) next.delete(nodeType)
      else next.add(nodeType)
      return next
    })
  }

  const exportPng = () => {
    const canvas = graphContainerRef.current?.querySelector('canvas')
    const png = canvas?.toDataURL('image/png')
    if (png)
      downloadBlob(
        Uint8Array.from(atob(png.split(',')[1]), (char) => char.charCodeAt(0)),
        'image/png',
        'agenticvault-security-graph.png'
      )
  }

  const links = metadata?.agenticvault?.links ?? []
  const lifecycle = metadata?.agenticvault?.lifecycle
  const evidence = metadata?.agenticvault?.evidence

  return (
    <section className={`${styles.workbench} ${className ?? ''}`} style={{ height }}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.productMark}>
            <Network aria-hidden="true" />
          </span>
          <div>
            <strong>Security graph</strong>
            <span>
              {document.source.product.toUpperCase()} · {filtered.nodes.length} entities ·{' '}
              {filtered.edges.length} relationships
            </span>
          </div>
        </div>
        <label className={styles.search}>
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search resources, findings, evidence…"
            aria-label="Search graph"
          />
          <kbd>/</kbd>
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            title="Find path"
            aria-pressed={pathMode}
            className={pathMode ? styles.activeButton : undefined}
            onClick={() => {
              setPathMode((current) => !current)
              setPathEndpoints([])
            }}
          >
            <Route aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Zoom out"
            onClick={() => graphRef.current?.zoom((graphRef.current.zoom() ?? 1) / 1.35, 250)}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Zoom in"
            onClick={() => graphRef.current?.zoom((graphRef.current.zoom() ?? 1) * 1.35, 250)}
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Fit graph"
            onClick={() => graphRef.current?.zoomToFit(350, 36)}
          >
            <Focus aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Export JSON"
            onClick={() =>
              downloadBlob(
                JSON.stringify(document, null, 2),
                'application/json',
                'agenticvault-security-graph.json'
              )
            }
          >
            <Download aria-hidden="true" />
          </button>
          <button type="button" title="Export PNG" onClick={exportPng}>
            PNG
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.rail} aria-label="Graph filters">
          <p className={styles.eyebrow}>Entity types</p>
          {nodeTypes.map((nodeType) => (
            <label key={nodeType} className={styles.typeFilter}>
              <input
                type="checkbox"
                checked={enabledTypes.has(nodeType)}
                onChange={() => toggleType(nodeType)}
              />
              <span>{nodeType}</span>
              <small>{graph.nodes.filter((node) => node.nodeType === nodeType).length}</small>
            </label>
          ))}
          <div className={styles.legend}>
            <p className={styles.eyebrow}>Signal</p>
            <span>
              <i className={styles.critical} /> Critical
            </span>
            <span>
              <i className={styles.investigating} /> Investigating
            </span>
            <span>
              <i className={styles.verified} /> Verified
            </span>
          </div>
        </aside>

        <div ref={graphContainerRef} className={styles.canvas}>
          {size.width > 0 && size.height > 0 && filtered.nodes.length > 0 ? (
            <ForceGraph2D<GraphNode, GraphEdge>
              ref={graphRef}
              width={size.width}
              height={size.height}
              graphData={filtered}
              backgroundColor="#080B10"
              nodeCanvasObject={renderNode}
              nodePointerAreaPaint={(node, color, context) => {
                context.fillStyle = color
                context.fill(nodeShapePath(node, Math.max(7, node.nodeSize)))
              }}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => setSelectedId(null)}
              linkColor={(edge) =>
                pathEdgeIds.has(edge.id)
                  ? '#18C7B5'
                  : edge.metadata?.attack_path
                    ? '#FFB000'
                    : '#3B4A5F'
              }
              linkWidth={(edge) =>
                pathEdgeIds.has(edge.id) ? 3 : edge.metadata?.privileged ? 2 : 1
              }
              linkLineDash={(edge) =>
                edge.metadata?.attack_path && !pathEdgeIds.has(edge.id) ? [5, 4] : []
              }
              linkDirectionalParticles={(edge) => (pathEdgeIds.has(edge.id) ? 3 : 0)}
              linkDirectionalParticleColor={() => '#D9FFFA'}
              cooldownTicks={120}
              onEngineStop={() => graphRef.current?.zoomToFit(300, 44)}
            />
          ) : (
            <div className={styles.empty}>
              <Network aria-hidden="true" />
              <strong>No matching graph entities</strong>
              <span>Adjust search or entity filters.</span>
            </div>
          )}
          {pathMode && (
            <div className={styles.pathPrompt}>
              {pathEndpoints.length === 0
                ? 'Select a path origin'
                : pathEndpoints.length === 1
                  ? 'Select a destination'
                  : path
                    ? `${path.nodeIds.length} entities in shortest path`
                    : 'No path found'}
              <button
                type="button"
                onClick={() => {
                  setPathMode(false)
                  setPathEndpoints([])
                }}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {detailsOpen && selectedNode ? (
          <aside className={styles.details} aria-label="Selected entity details">
            <button
              className={styles.closeDetails}
              type="button"
              onClick={() => setDetailsOpen(false)}
              aria-label="Close details"
            >
              <PanelRightClose aria-hidden="true" />
            </button>
            <p className={styles.eyebrow}>{selectedNode.nodeType}</p>
            <h2>{selectedNode.nodeLabel}</h2>
            <span className={styles.entityId}>
              {String(selectedNode.nodeProperties.agenticvault_raw_id)}
            </span>
            <div className={styles.detailGrid}>
              {Object.entries(selectedNode.nodeProperties)
                .filter(([, value]) => value !== undefined)
                .map(([key, value]) => (
                  <div key={key}>
                    <span>{key.replaceAll('_', ' ')}</span>
                    <strong>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </strong>
                  </div>
                ))}
            </div>
            {lifecycle && (
              <div className={styles.section}>
                <p className={styles.eyebrow}>Lifecycle</p>
                {Object.entries(lifecycle)
                  .filter(([, value]) => value !== undefined)
                  .map(([key, value]) => (
                    <div className={styles.lifecycleRow} key={key}>
                      <span>{key.replaceAll('_', ' ')}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))}
              </div>
            )}
            <div className={styles.section}>
              <p className={styles.eyebrow}>Evidence</p>
              <strong>{evidence?.length ?? 0} attached records</strong>
              {evidence?.map((item, index) => (
                <pre key={index}>{JSON.stringify(item, null, 2)}</pre>
              ))}
            </div>
            {links.length > 0 && (
              <div className={styles.section}>
                <p className={styles.eyebrow}>Open in product</p>
                {links.map((link) => (
                  <a
                    key={`${link.kind}:${link.href}`}
                    href={link.href}
                    onClick={(event) => {
                      if (onNavigate) {
                        event.preventDefault()
                        onNavigate(link, selectedNode)
                      }
                    }}
                  >
                    {link.label}
                    <ExternalLink aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </aside>
        ) : selectedNode ? (
          <button
            type="button"
            className={styles.openDetails}
            onClick={() => setDetailsOpen(true)}
            aria-label="Open details"
          >
            <PanelRightOpen aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <footer className={styles.footer}>
        <span>
          <i className={styles.liveDot} /> Contract {document.version}
        </span>
        <span>Generated {new Date(document.source.generated_at).toLocaleString()}</span>
        <span>Esc clear · / search</span>
      </footer>
    </section>
  )
}

export const SecurityGraphWorkbench = (props: SecurityGraphWorkbenchProps) => {
  const documentKey = [
    props.document.source.product,
    props.document.source.tenant_id,
    props.document.source.generated_at
  ].join(':')
  return <SecurityGraphWorkbenchView key={documentKey} {...props} />
}

export default SecurityGraphWorkbench
