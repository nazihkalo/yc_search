export function VideoEmbed() {
  return (
    <section id="tour" className="relative mx-auto w-full max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-primary/5"
        />
        <video
          className="relative block h-auto w-full"
          src="/ycsearch-demo-2x.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/logos/yc_search_logo.png"
        />
      </div>
    </section>
  );
}
