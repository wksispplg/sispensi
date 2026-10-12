/** Kerangka (skeleton) saat halaman di dalam aplikasi sedang dimuat. */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Memuat…</span>
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-7 w-48 rounded-md motion-safe:animate-pulse" />
        <div className="bg-muted h-4 w-72 max-w-full rounded-md motion-safe:animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-muted/60 h-20 rounded-xl border motion-safe:animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
