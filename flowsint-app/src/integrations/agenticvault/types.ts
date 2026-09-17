export const AGENTICVAULT_GRAPH_VERSION = 'agenticvault.graph/v1' as const

export type AgenticVaultProduct = 'cspm' | 'soc'
export type AgenticVaultSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown'

export type AgenticVaultGraphLinkKind = 'record' | 'inventory' | 'finding' | 'alert' | 'case'

export type AgenticVaultGraphLink = {
  label: string
  href: string
  kind: AgenticVaultGraphLinkKind
}

export type AgenticVaultLifecycle = {
  verification_state?: string
  verification_confidence?: number
  mitigation_status?: string
  reevaluation_status?: string
  first_seen?: string
  last_seen?: string
  investigated_at?: string
  mitigated_at?: string
  reevaluated_at?: string
  [key: string]: unknown
}

export type AgenticVaultGraphNode = {
  id: string
  kind: string
  label: string
  severity?: AgenticVaultSeverity
  status?: string
  confidence?: number
  properties?: Record<string, unknown>
  lifecycle?: AgenticVaultLifecycle
  evidence?: unknown[]
  links?: AgenticVaultGraphLink[]
  x?: number
  y?: number
}

export type AgenticVaultGraphEdge = {
  id: string
  source: string
  target: string
  relationship: string
  confidence?: number
  evidence_count?: number
  attack_path?: boolean
  privileged?: boolean
  properties?: Record<string, unknown>
}

export type AgenticVaultGraphDocument = {
  version: typeof AGENTICVAULT_GRAPH_VERSION
  source: {
    product: AgenticVaultProduct
    tenant_id: string
    generated_at: string
    canonical_url?: string
  }
  focus?: string
  nodes: AgenticVaultGraphNode[]
  edges: AgenticVaultGraphEdge[]
}
