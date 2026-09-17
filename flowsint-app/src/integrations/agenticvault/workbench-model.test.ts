import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '@/types/graph'
import { filterSecurityGraph, findSecurityGraphPath } from './workbench-model'

const node = (id: string, type: string, label = id): GraphNode => ({
  id,
  nodeType: type,
  nodeLabel: label,
  nodeProperties: {},
  nodeSize: 12,
  nodeColor: null,
  nodeIcon: null,
  nodeImage: null,
  nodeFlag: null,
  nodeShape: 'circle',
  nodeMetadata: {},
  x: 0,
  y: 0
})

const edge = (id: string, source: string, target: string): GraphEdge => ({
  id,
  source,
  target,
  label: 'CONNECTED_TO'
})

describe('security graph workbench model', () => {
  const nodes = [
    node('alert', 'alert'),
    node('finding', 'finding'),
    node('resource', 'resource', 'prod bucket')
  ]
  const edges = [edge('a-f', 'alert', 'finding'), edge('f-r', 'finding', 'resource')]

  it('filters nodes and removes edges with hidden endpoints', () => {
    expect(filterSecurityGraph(nodes, edges, 'bucket', new Set(['resource']))).toEqual({
      nodes: [nodes[2]],
      edges: []
    })
  })

  it('finds the shortest undirected investigation path', () => {
    expect(findSecurityGraphPath(edges, 'alert', 'resource')).toEqual({
      nodeIds: ['alert', 'finding', 'resource'],
      edgeIds: ['a-f', 'f-r']
    })
  })

  it('returns null when the graph is disconnected', () => {
    expect(findSecurityGraphPath(edges, 'alert', 'missing')).toBeNull()
  })

  it('cannot route through entities removed by a filter', () => {
    const visible = filterSecurityGraph(nodes, edges, '', new Set(['alert', 'resource']))
    expect(findSecurityGraphPath(visible.edges, 'alert', 'resource')).toBeNull()
  })
})
