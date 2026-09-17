import { describe, expect, it } from 'vitest'
import { adaptAgenticVaultGraph, namespaceAgenticVaultId } from './graph-adapter'
import { AGENTICVAULT_GRAPH_VERSION, type AgenticVaultGraphDocument } from './types'

const cspmDocument = (): AgenticVaultGraphDocument => ({
  version: AGENTICVAULT_GRAPH_VERSION,
  source: {
    product: 'cspm',
    tenant_id: 'tenant-a',
    generated_at: '2026-09-16T12:00:00Z',
    canonical_url: 'https://cspm.agenticvaultai.com/findings-alerts'
  },
  focus: 'finding-1',
  nodes: [
    {
      id: 'bucket-1',
      kind: 'resource',
      label: 'prod-audit-logs',
      severity: 'high',
      properties: { account_id: '123456789012', region: 'us-east-1', provider: 'aws' },
      links: [
        { label: 'Inventory', href: '/inventory?resource=bucket-1', kind: 'inventory' },
        { label: 'Unsafe', href: 'javascript:alert(1)', kind: 'record' }
      ]
    },
    {
      id: 'finding-1',
      kind: 'finding',
      label: 'S3 bucket permits public access',
      severity: 'critical',
      lifecycle: { verification_state: 'confirmed', mitigation_status: 'open' },
      evidence: [{ type: 'policy', principal: '*' }]
    }
  ],
  edges: [
    {
      id: 'finding-affects-bucket',
      source: 'finding-1',
      target: 'bucket-1',
      relationship: 'AFFECTS',
      confidence: 0.98,
      evidence_count: 1,
      attack_path: true,
      properties: { path_order: 1 }
    }
  ]
})

describe('adaptAgenticVaultGraph', () => {
  it('maps CSPM context without dropping domain properties', () => {
    const result = adaptAgenticVaultGraph(cspmDocument())
    const resource = result.nodes.find((node) => node.nodeType === 'resource')

    expect(result.focusId).toBe('cspm:tenant-a:finding-1')
    expect(resource?.nodeProperties).toMatchObject({
      account_id: '123456789012',
      region: 'us-east-1',
      provider: 'aws'
    })
    expect(resource?.nodeShape).toBe('hexagon')
    expect(result.edges[0]).toMatchObject({
      source: 'cspm:tenant-a:finding-1',
      target: 'cspm:tenant-a:bucket-1',
      type: 'attack_path',
      confidence_level: 0.98,
      metadata: { evidence_count: 1, attack_path: true, path_order: 1 }
    })
  })

  it('keeps SOC evidence and lifecycle metadata', () => {
    const document: AgenticVaultGraphDocument = {
      ...cspmDocument(),
      source: { product: 'soc', tenant_id: 'tenant-a', generated_at: '2026-09-16T12:01:00Z' },
      focus: 'alert-1',
      nodes: [
        {
          id: 'alert-1',
          kind: 'alert',
          label: 'Confirmed public database exposure',
          status: 'investigating',
          confidence: 0.96,
          lifecycle: {
            verification_state: 'confirmed',
            mitigation_status: 'in_progress',
            reevaluation_status: 'pending'
          },
          evidence: [{ source: 'cspm', finding_id: 'finding-77' }],
          links: [
            { label: 'Alert', href: '/alerts/alert-1', kind: 'alert' },
            {
              label: 'Finding',
              href: 'https://cspm.agenticvaultai.com/findings-alerts?finding=finding-77',
              kind: 'finding'
            }
          ]
        }
      ],
      edges: []
    }

    const result = adaptAgenticVaultGraph(document)
    const metadata = result.nodes[0].nodeMetadata.agenticvault
    expect(metadata).toMatchObject({
      product: 'soc',
      lifecycle: {
        verification_state: 'confirmed',
        mitigation_status: 'in_progress',
        reevaluation_status: 'pending'
      },
      evidence: [{ source: 'cspm', finding_id: 'finding-77' }]
    })
  })

  it('removes unsafe and malformed action links', () => {
    const result = adaptAgenticVaultGraph(cspmDocument())
    const metadata = result.nodes[0].nodeMetadata.agenticvault as {
      links: { href: string }[]
    }

    expect(metadata.links).toEqual([
      { label: 'Inventory', href: '/inventory?resource=bucket-1', kind: 'inventory' }
    ])
  })

  it('rejects duplicate nodes and dangling edges', () => {
    const duplicate = cspmDocument()
    duplicate.nodes.push({ ...duplicate.nodes[0] })
    expect(() => adaptAgenticVaultGraph(duplicate)).toThrow('Duplicate AgenticVault node id')

    const dangling = cspmDocument()
    dangling.edges[0].target = 'missing'
    expect(() => adaptAgenticVaultGraph(dangling)).toThrow('references an unknown node')
  })

  it('rejects unsupported versions and invalid focus ids', () => {
    const wrongVersion = {
      ...cspmDocument(),
      version: 'agenticvault.graph/v2'
    } as unknown as AgenticVaultGraphDocument
    expect(() => adaptAgenticVaultGraph(wrongVersion)).toThrow(
      'Unsupported AgenticVault graph version'
    )

    const badFocus = cspmDocument()
    badFocus.focus = 'missing'
    expect(() => adaptAgenticVaultGraph(badFocus)).toThrow('focus references an unknown node')
  })

  it('namespaces ids deterministically and without ambiguous delimiters', () => {
    expect(namespaceAgenticVaultId('cspm', 'tenant:one', 'node/1')).toBe(
      'cspm:tenant%3Aone:node%2F1'
    )
  })
})
