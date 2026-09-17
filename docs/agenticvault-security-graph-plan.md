# AgenticVault security graph port

## Decision

Use the Flowsint graph interaction model as the shared presentation layer for
CSPM and SOC, while keeping each product's existing data, authorization, and
workflow APIs as the source of truth.

Flowsint's Neo4j-backed application remains available in this fork, but the
AgenticVault integration must not require Neo4j. CSPM and SOC production
continue to deploy PostgreSQL and Redis only.

## Capability baseline

### Preserve from CSPM

- Inventory topology and resource search
- Resource-type, account, region, severity, and finding filters
- Attack-path highlighting and path detail
- Blast-radius calculation and affected-resource summaries
- Finding and resource deep links
- Risk, exposure, privilege, and relationship metadata
- Account mapping, attack-path clustering, and security-intelligence views

### Preserve from SOC

- Confirmed-alert gating and source correlation identifiers
- Investigation evidence and enrichment context
- Resource context and originating CSPM finding links
- Verification confidence, mitigation state, and re-evaluation lifecycle
- Case, alert, artifact, enrichment, and knowledge navigation
- Tenant and role-based access controls

### Port from Flowsint

- Full-canvas graph with stable force and hierarchy layouts
- Search, type filters, relationship filters, and focus navigation
- Multi-select, shortest-path analysis, and highlighted path panel
- Expandable entity and relationship details
- Zoom controls, fit-to-selection, minimap, and keyboard navigation
- JSON and PNG export
- Large-graph rendering behavior and explicit loading/empty/error states

## Shared contract

All product adapters emit `agenticvault.graph/v1` documents. The contract is
read-only at the product boundary; mutations continue through CSPM or SOC APIs.

```text
AgenticVaultGraphDocument
├── version: "agenticvault.graph/v1"
├── source: product, tenant, generated time, canonical URL
├── focus: optional entity identifier
├── nodes[]
│   ├── id, kind, label
│   ├── severity, status, confidence
│   ├── resource and investigation properties
│   ├── lifecycle and evidence summaries
│   └── product deep links
└── edges[]
    ├── id, source, target, relationship
    ├── confidence and evidence count
    └── attack-path and privileged-edge flags
```

Identifiers are namespaced by product and tenant before rendering. URLs accept
only relative paths or HTTPS. Unknown metadata is retained under `properties`
so the adapter does not discard product-specific value.

## UI direction

### Color

- Obsidian canvas `#080B10`
- Raised graphite `#111722`
- Structural line `#263244`
- Investigation amber `#FFB000`
- Verified teal `#18C7B5`
- Critical signal `#FF4D5E`

Severity and verification colors encode state. Decorative gradients are not
used. The graph is the visual focus.

### Type

- Product UI: the host application's existing sans-serif family
- Resource identifiers and evidence values: the host monospace family
- Tabular values use tabular numerals

### Layout

```text
┌ source + scope ─ search ─ filters ─ layout/export controls ┐
├ entity rail ───────────────────── graph canvas ─ detail dock┤
│ saved/focused entities       attack path       evidence     │
│ result counts                blast radius      lifecycle    │
└ status, freshness, selection, keyboard help ────────────────┘
```

The canvas remains dominant. The entity rail and detail dock resize or collapse
instead of covering the graph. Text is left aligned; identifiers never truncate
without a copy or reveal action.

### Product-specific character

The memorable element is the live investigation path: confirmed evidence uses
a solid teal trace, inferred relationships use a dashed amber trace, and
critical exposure uses red only at the affected node or edge. This comes from
security investigation semantics rather than generic dashboard decoration.

## Delivery plan

1. **Fork and contract**
   - Preserve upstream history, license, and NOTICE.
   - Add the versioned AgenticVault graph contract and a tested Flowsint adapter.
   - Verify malformed documents fail closed and unsafe links are removed.

2. **Portable workbench**
   - Isolate the read-only Flowsint graph canvas and controls from Neo4j-specific
     sketch mutations.
   - Accept the shared contract and product callbacks as props.
   - Verify search, filters, path finding, layouts, selection, and export.

3. **CSPM adapter**
   - Map inventory, findings, attack paths, blast radius, and lifecycle records.
   - Replace the finding graph surface first, then the inventory graph canvas.
   - Keep current CSPM actions and deep links available in the detail dock.

4. **SOC adapter**
   - Map alert security context, evidence, resources, related findings, and paths.
   - Add graph access from alert and case details.
   - Keep source CSPM and inventory navigation in the detail dock.

5. **Synchronization and release**
   - Pin both adapters to the same contract version and canonical workbench SHA.
   - Add contract fixtures shared by CSPM and SOC CI.
   - Require product tests, accessibility checks, production builds, Greptile
     5/5, resolved conversations, merge, and live end-to-end verification.

## Acceptance criteria

- No CSPM or SOC graph capability listed above is removed.
- A confirmed CSPM finding renders the same resource and attack path in CSPM
  and SOC from the same stable identifiers.
- Mitigation and re-evaluation updates change graph state without duplicating
  the finding or alert.
- Clicking a graph entity opens the correct product record and inventory filter.
- Missing evidence is shown as missing and is never synthesized.
- Tenant context is required at every API boundary.
- Production adds no Neo4j or SQLite service.
- Greptile reports 5/5 and every review conversation is resolved before merge.
