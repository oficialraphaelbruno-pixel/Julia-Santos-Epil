import Image from "next/image";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grain grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mx-auto mb-8 h-24 w-[150px] relative">
          <Image src="/brand/julia-santos-logo.png" alt="Julia Santos Epil" fill priority sizes="150px" className="object-contain" />
        </div>
        <div className="card-premium p-7">
          <h1 className="text-center text-2xl text-ink">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-center text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">Studio Manager · Área restrita</p>
      </div>
    </main>
  );
}
