"use client";

import { useId, useState, type FormEvent } from "react";

type Estado = { tipo: "inicial" } | { tipo: "erro"; mensagem: string } | { tipo: "confirmado"; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Inscrição na newsletter em modo de simulação: valida o e-mail e mostra erro ou
 * confirmação, mas não envia nem guarda nada até haver integração com o provedor — e diz
 * isso ao leitor antes e depois do envio.
 */
export function NewsletterForm() {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicial" });
  const id = useId();
  const erroId = `${id}-erro`;

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return setEstado({ tipo: "erro", mensagem: "Informe um e-mail." });
    if (!EMAIL.test(email)) return setEstado({ tipo: "erro", mensagem: "Esse e-mail não parece válido. Confira e tente de novo." });
    setEstado({ tipo: "confirmado", email });
  }

  if (estado.tipo === "confirmado") {
    return (
      <div role="status" className="flex flex-col gap-2">
        <p className="m-0 text-[17px] font-bold">Inscrição registrada (simulação).</p>
        <p className="m-0 text-sm leading-normal text-mn-ink-3">
          Nada foi enviado nem guardado: a newsletter ainda não está ligada a um provedor de e-mail. Com a integração
          pronta, a confirmação irá para <strong>{estado.email}</strong>.
        </p>
        <button
          type="button"
          onClick={() => setEstado({ tipo: "inicial" })}
          className="mt-2 w-max cursor-pointer border border-mn-line-3 bg-white px-5 py-2.5 font-sans text-xs text-mn-ink"
        >
          Usar outro e-mail
        </button>
      </div>
    );
  }

  const erro = estado.tipo === "erro" ? estado.mensagem : null;
  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-3">
      <p className="m-0 border-l-[3px] border-mn-red bg-mn-surface px-3 py-2 text-[13px] leading-normal text-mn-ink-2">
        <strong>Simulação:</strong> a inscrição ainda não está integrada a um provedor de e-mail. O formulário mostra como
        vai funcionar, mas não envia nem guarda o seu endereço.
      </p>
      <label htmlFor={`${id}-email`} className="text-sm font-semibold">
        Seu e-mail
      </label>
      <div className="flex gap-2 mob:flex-col">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          className={`h-11 min-w-0 flex-1 border px-3 font-sans text-[15px] ${erro ? "border-mn-red" : "border-mn-line-3"}`}
        />
        <button
          type="submit"
          className="h-11 cursor-pointer border-0 bg-mn-red px-6 font-sans text-sm font-bold text-white"
        >
          Inscrever-se
        </button>
      </div>
      {erro && (
        <p id={erroId} role="alert" className="m-0 text-[13px] font-semibold text-mn-red-text">
          {erro}
        </p>
      )}
    </form>
  );
}
