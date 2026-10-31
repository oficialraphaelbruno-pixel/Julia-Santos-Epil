import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grain grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="ornament">Página não encontrada</p>
        <h1 className="mt-5 text-4xl text-ink">Ops! Não encontramos esta página.</h1>
        <p className="mt-3 text-muted">O endereço pode ter mudado ou o link expirou.</p>
        <Button asChild className="mt-8">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  );
}
