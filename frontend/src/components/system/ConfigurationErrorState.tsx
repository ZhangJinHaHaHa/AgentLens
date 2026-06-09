import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ConfigurationErrorStateProps {
  error: string;
}

export function ConfigurationErrorState({ error }: ConfigurationErrorStateProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide">Configuration error</span>
          </div>
          <CardTitle>AgentLens needs an environment value before it can boot</CardTitle>
          <CardDescription>
            Set the missing variable in your <code className="font-mono text-xs">.env</code> (see
            <code className="ml-1 font-mono text-xs">frontend/.env.example</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs text-foreground">
            {error}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
