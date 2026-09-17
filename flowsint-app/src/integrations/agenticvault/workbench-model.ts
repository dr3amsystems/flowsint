import type { GraphEdge, GraphNode } from '@/types/graph'

export const graphEndpointId = (endpoint: GraphEdge['source']): string =>
  typeof endpoint === 'object' ? (endpoint as { id: string }).id : endpoint

export const filterSecurityGraph = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  query: string,
  enabledTypes: ReadonlySet<string>
): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const needle = query.trim().toLowerCase()
  const filteredNodes = nodes.filter((node) => {
    if (!enabledTypes.has(node.nodeType)) return false
    if (!needle) return true
    return [node.nodeLabel, node.nodeType, JSON.stringify(node.nodeProperties)]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })
  const ids = new Set(filteredNodes.map((node) => node.id))
  return {
    nodes: filteredNodes,
    edges: edges.filter(
      (edge) => ids.has(graphEndpointId(edge.source)) && ids.has(graphEndpointId(edge.target))
    )
  }
}

export const findSecurityGraphPath = (
  edges: GraphEdge[],
  startId: string,
  endId: string
): { nodeIds: string[]; edgeIds: string[] } | null => {
  if (startId === endId) return { nodeIds: [startId], edgeIds: [] }

  const adjacency = new Map<string, { nodeId: string; edgeId: string }[]>()
  for (const edge of edges) {
    const source = graphEndpointId(edge.source)
    const target = graphEndpointId(edge.target)
    adjacency.set(source, [...(adjacency.get(source) ?? []), { nodeId: target, edgeId: edge.id }])
    adjacency.set(target, [...(adjacency.get(target) ?? []), { nodeId: source, edgeId: edge.id }])
  }

  const queue = [startId]
  const visited = new Set(queue)
  const previous = new Map<string, { nodeId: string; edgeId: string }>()

  while (queue.length) {
    const current = queue.shift()
    if (!current) break
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.nodeId)) continue
      visited.add(neighbor.nodeId)
      previous.set(neighbor.nodeId, { nodeId: current, edgeId: neighbor.edgeId })
      if (neighbor.nodeId === endId) {
        const nodeIds = [endId]
        const edgeIds: string[] = []
        let cursor = endId
        while (cursor !== startId) {
          const step = previous.get(cursor)
          if (!step) return null
          edgeIds.unshift(step.edgeId)
          nodeIds.unshift(step.nodeId)
          cursor = step.nodeId
        }
        return { nodeIds, edgeIds }
      }
      queue.push(neighbor.nodeId)
    }
  }

  return null
}
