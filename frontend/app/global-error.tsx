"use client";

/** Último recurso: o próprio layout falhou. Estilos inline, porque o CSS global pode não ter carregado. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "Helvetica Neue, Arial, sans-serif", color: "#111" }}>
        <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 16px" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#B00710", textTransform: "uppercase" }}>Erro 500</p>
          <h1 style={{ margin: "12px 0 0", fontSize: 30, lineHeight: 1.1 }}>O Máquina Nerd está fora do ar por um instante.</h1>
          <p style={{ margin: "16px 0 0", fontSize: 17, lineHeight: 1.6, color: "#333" }}>Tente de novo em alguns segundos.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 32, height: 44, padding: "0 24px", border: 0, background: "#E30613", color: "#fff", fontWeight: 700, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
