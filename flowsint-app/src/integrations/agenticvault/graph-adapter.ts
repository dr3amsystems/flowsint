import type { GraphEdge, GraphNode, NodeShape } from '@/types/graph'
import {
  AGENTICVAULT_GRAPH_VERSION,
  type AgenticVaultGraphDocument,
  type AgenticVaultGraphLink,
  type AgenticVaultGraphNode,
  type AgenticVaultProduct,
  type AgenticVaultSeverity
} from './types'

const SEVERITY_STYLE: Record<AgenticVaultSeverity, { color: string; size: number }> = {
  critical: { color: '#FF4D5E', size: 18 },
  high: { color: '#FF7A45', size: 16 },
  medium: { color: '#FFB000', size: 14 },
  low: { color: '#18C7B5', size: 12 },
  info: { color: '#58A6FF', size: 11 },
  unknown: { color: '#7C8DA6', size: 11 }
}

const NODE_PRESENTATION: Record<string, { icon: GraphNode['nodeIcon']; shape: NodeShape }> = {
  alert: { icon: 'BellRing', shape: 'triangle' },
  case: { icon: 'Briefcase', shape: 'square' },
  evidence: { icon: 'Fingerprint', shape: 'circle' },
  finding: { icon: 'ShieldAlert', shape: 'triangle' },
  identity: { icon: 'UserRound', shape: 'circle' },
  internet: { icon: 'Globe2', shape: 'hexagon' },
  resource: { icon: 'Box', shape: 'hexagon' },
  service: { icon: 'Cloud', shape: 'square' }
}

export type AgenticVaultGraphAdapterResult = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  focusId?: string
}

const requireText = (value: string, field: string): string => {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${field} must not be empty`)
  return normalized
}

export const namespaceAgenticVaultId = (
  product: AgenticVaultProduct,
  tenantId: string,
  id: string
): string =>
  [product, requireText(tenantId, 'source.tenant_id'), requireText(id, 'id')]
    .map(encodeURIComponent)
    .join(':')

export const sanitizeAgenticVaultLink = (
  link: AgenticVaultGraphLink
): AgenticVaultGraphLink | null => {
  const href = link.href.trim()
  if (href.startsWith('/') && !href.startsWith('//')) return { ...link, href }

  try {
    const parsed = new URL(href)
    return parsed.protocol === 'https:' ? { ...link, href: parsed.toString() } : null
  } catch {
    return null
  }
}

const sanitizeLinks = (links: AgenticVaultGraphLink[] | undefined): AgenticVaultGraphLink[] =>
  (links ?? []).flatMap((link) => {
    const sanitized = sanitizeAgenticVaultLink(link)
    return sanitized ? [sanitized] : []
  })

const normalizedSeverity = (severity: AgenticVaultGraphNode['severity']): AgenticVaultSeverity =>
  severity && severity in SEVERITY_STYLE ? severity : 'unknown'

const presentationFor = (kind: string) =>
  NODE_PRESENTATION[kind.toLowerCase()] ?? { icon: 'CircleDot', shape: 'circle' as const }

export const adaptAgenticVaultGraph = (
  document: AgenticVaultGraphDocument
): AgenticVaultGraphAdapterResult => {
  if (document.version !== AGENTICVAULT_GRAPH_VERSION) {
    throw new Error(`Unsupported AgenticVault graph version: ${String(document.version)}`)
  }

  const tenantId = requireText(document.source.tenant_id, 'source.tenant_id')
  const rawNodeIds = new Set<string>()

  for (const node of document.nodes) {
    const rawId = requireText(node.id, 'node.id')
    if (rawNodeIds.has(rawId)) throw new Error(`Duplicate AgenticVault node id: ${rawId}`)
    rawNodeIds.add(rawId)
  }

  const nodes = document.nodes.map((node): GraphNode => {
    const severity = normalizedSeverity(node.severity)
    const style = SEVERITY_STYLE[severity]
    const presentation = presentationFor(node.kind)
    const links = sanitizeLinks(node.links)

    return {
      id: namespaceAgenticVaultId(document.source.product, tenantId, node.id),
      nodeType: requireText(node.kind, 'node.kind'),
      nodeLabel: requireText(node.label, 'node.label'),
      nodeProperties: {
        ...(node.properties ?? {}),
        agenticvault_raw_id: node.id,
        severity,
        status: node.status,
        confidence: node.confidence
      },
      nodeSize: style.size,
      nodeColor: style.color,
      nodeIcon: presentation.icon,
      nodeImage: null,
      nodeFlag: null,
      nodeShape: presentation.shape,
      nodeMetadata: {
        agenticvault: {
          product: document.source.product,
          tenant_id: tenantId,
          generated_at: document.source.generated_at,
          canonical_url: document.source.canonical_url,
          lifecycle: node.lifecycle,
          evidence: node.evidence,
          links
        }
      },
      x: node.x ?? 0,
      y: node.y ?? 0
    }
  })

  const edgeIds = new Set<string>()
  const edges = document.edges.map((edge): GraphEdge => {
    const edgeId = requireText(edge.id, 'edge.id')
    if (edgeIds.has(edgeId)) throw new Error(`Duplicate AgenticVault edge id: ${edgeId}`)
    edgeIds.add(edgeId)
    if (!rawNodeIds.has(edge.source) || !rawNodeIds.has(edge.target)) {
      throw new Error(`AgenticVault edge ${edgeId} references an unknown node`)
    }

    return {
      id: namespaceAgenticVaultId(document.source.product, tenantId, edgeId),
      source: namespaceAgenticVaultId(document.source.product, tenantId, edge.source),
      target: namespaceAgenticVaultId(document.source.product, tenantId, edge.target),
      label: requireText(edge.relationship, 'edge.relationship'),
      caption: edge.relationship,
      type: edge.attack_path ? 'attack_path' : edge.relationship,
      weight: edge.privileged ? 2 : 1,
      confidence_level: edge.confidence,
      metadata: {
        ...(edge.properties ?? {}),
        evidence_count: edge.evidence_count,
        attack_path: edge.attack_path ?? false,
        privileged: edge.privileged ?? false,
        agenticvault_raw_id: edge.id
      }
    }
  })

  if (document.focus && !rawNodeIds.has(document.focus)) {
    throw new Error(`AgenticVault focus references an unknown node: ${document.focus}`)
  }

  return {
    nodes,
    edges,
    focusId: document.focus
      ? namespaceAgenticVaultId(document.source.product, tenantId, document.focus)
      : undefined
  }
}
