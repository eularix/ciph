import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center px-6 py-20">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
        <section>
          <p className="mb-4 inline-flex rounded-full border px-3 py-1 text-xs text-fd-muted-foreground">
            Ciph • Transparent HTTP Encryption
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Encrypt API traffic without changing your developer flow.
          </h1>

          <p className="mt-5 max-w-xl text-fd-muted-foreground sm:text-lg">
            Ciph keeps request and response payloads protected at the
            application layer while your frontend and backend code stays clean.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/docs/getting-started"
              className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
            <Link
              href="/docs"
              className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              Read Docs
            </Link>
            <Link
              href="/generate-key"
              className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              Generate Key
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border bg-fd-card p-6">
          <p className="mb-3 text-sm text-fd-muted-foreground">Why Ciph</p>
          <ul className="space-y-3 text-sm">
            <li className="rounded-md border p-3">
              Ciphertext payloads in browser and network tools
            </li>
            <li className="rounded-md border p-3">
              No manual encrypt/decrypt calls in app code
            </li>
            <li className="rounded-md border p-3">
              Client + server middleware architecture
            </li>
            <li className="rounded-md border p-3">
              Built-in devtools for debugging in development
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
