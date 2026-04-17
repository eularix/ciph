import { AlertTriangle } from 'lucide-react';

export default function GenerateKeyPage() {
  const envKey = 'ciph_env_' + 'x'.repeat(32);

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <div className="rounded-xl border bg-card p-8 shadow-lg">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Generate Environment Key</h1>
            <p className="text-muted-foreground">
              This is your <code>CIPH_ENV_KEY</code>. Keep it secret and rotate regularly.
            </p>
          </div>
          
          <div className="flex items-start gap-2 rounded-md border bg-destructive/5 p-4">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
            <div className="text-sm">
              Never commit this key to version control or expose it publicly.
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="font-mono bg-muted rounded-md p-3 text-sm break-all">
              {envKey}
            </div>
            <button className="w-full rounded-md border bg-muted px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
              Copy Key
            </button>
          </div>

          <div className="flex gap-2 pt-4">
            <a href="/docs/getting-started" className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Continue Setup
            </a>
            <a href="/" className="flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
              ← Back Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
