import { memo } from 'react'
import { HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '../ui/dialog'
import { Button } from '../ui/button'

const InfoDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <div>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs">
            <HelpCircle className="h-3 w-3 opacity-60" />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <div className="p-2">
          <div className="p-2 text-sm space-y-4 overflow-y-auto max-h-[80vh]">
            <h2 className="text-base font-semibold">About AgenticVault Security Graph</h2>
            <p>
              <strong>AgenticVault Security Graph</strong> connects cloud findings, alerts,
              resources, evidence, identities, and attack paths in one investigation workspace. It
              gives CSPM, SOC, and AIOps teams a shared view of the same security context.
            </p>

            <h3 className="font-semibold">What the graph provides</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Trace a confirmed finding from its source evidence to affected resources and
                downstream risk.
              </li>
              <li>
                Search and filter entities while preserving the investigation context around each
                result.
              </li>
              <li>
                Explore attack paths, blast radius, related alerts, and the finding lifecycle.
              </li>
              <li>
                Enrich entities through approved integrations and retain the resulting evidence.
              </li>
            </ul>

            <h3 className="font-semibold">Designed for security operations</h3>
            <p>
              The graph uses the shared <code>agenticvault.graph/v1</code> contract so CSPM, SOC,
              and AIOps can display synchronized evidence and resource context without duplicating
              product data. Product databases remain the source of truth.
            </p>

            <p className="text-muted-foreground">
              This interface is based on the Apache-2.0 Flowsint project. Attribution and source
              details are included in the repository notice.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default memo(InfoDialog)
