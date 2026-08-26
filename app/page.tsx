import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-16">
      <div className="sbq-card p-6 sm:p-10">
        <p className="sbq-eyebrow">Super Bowl Questions</p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Super Bowl Questions
        </h1>

        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Join a game using the invite link sent by your host.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/champions"
            className="sbq-touch-target inline-flex items-center justify-center rounded-xl border border-border bg-surface px-5 py-3 font-semibold text-foreground transition-colors hover:bg-surface-subtle"
          >
            Hall of Champions
          </Link>
        </div>
      </div>
    </div>
  );
}