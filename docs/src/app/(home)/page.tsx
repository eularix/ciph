import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <span className="mb-4 rounded-full border px-3 py-1 text-xs text-fd-muted-foreground">
          Transparent HTTP Encryption
        </span>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Ciph
        </h1>

        <p className="mt-4 max-w-2xl text-fd-muted-foreground sm:text-lg">
          Secure frontend-backend communication with automatic encryption and
          decryption, without changing how you write API code.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
            Open Docs
          </Link>
          <Link
            href="/#generate-key"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Generate Key
          </Link>
        </div>

        <section
          id="generate-key"
          className="mt-16 w-full max-w-2xl rounded-xl border p-6 text-left"
        >
          <h2 className="text-lg font-medium">Generate Environment Key</h2>
          <p className="mt-2 text-sm text-fd-muted-foreground">
            Use this key as your <code>CIPH_ENV_KEY</code>. Keep it secret and
            rotate it regularly.
          </p>
          <div className="mt-4 rounded-md bg-fd-secondary p-3 font-mono text-sm">
            ciph_env_************************
          </div>
        </section>
      </div>
    </main>
  );
}
