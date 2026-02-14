export default function ProjectDetailLoading() {
  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="flex items-center gap-2">
            <div className="size-8 animate-pulse rounded-lg bg-slate-100" />
            <div className="size-8 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="mt-6 flex gap-4 border-b border-slate-200 pb-2">
          <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="mt-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white border border-slate-200" />
          ))}
        </div>
      </main>
    </div>
  );
}
