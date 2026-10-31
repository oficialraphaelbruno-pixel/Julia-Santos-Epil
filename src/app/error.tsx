"use client";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grain grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="ornament">Julia Santos Epil</p>
        <h1 className="mt-5 text-3xl text-ink sm:text-4xl">Estamos ajustando alguns detalhes.</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Não foi possível carregar esta página agora. Tente novamente em instantes ou fale conosco pelo WhatsApp.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>Tentar novamente</Button>
          <Button asChild variant="whatsapp">
            <a href="https://wa.me/5531998628886" target="_blank" rel="noopener noreferrer">
              Falar pelo WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </main>
  );
}
