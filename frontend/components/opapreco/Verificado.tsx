"use client";

import { useEffect, useState } from "react";
import { checkedLabel, gridFootLabel } from "@/lib/ads/labels";

/**
 * Texto de verificação de preço: chega pronto do servidor e é recalculado no navegador a
 * cada minuto, já que a página pode ter saído do cache minutos depois de montada.
 */
export function Verificado({
  checkedAt,
  inicial,
  minusculo = false,
  grade,
}: {
  checkedAt: string | string[];
  inicial: string;
  minusculo?: boolean;
  /** Rodapé da grade: recebe a loja e usa a verificação mais antiga. */
  grade?: { merchant: string };
}) {
  const [texto, setTexto] = useState(inicial);
  const chave = Array.isArray(checkedAt) ? checkedAt.join("|") : checkedAt;

  useEffect(() => {
    const calcula = () => {
      const now = Date.now();
      const lista = chave.split("|");
      setTexto(
        grade
          ? gridFootLabel(lista, grade.merchant, now)
          : (checkedLabel(lista[0]!, now, minusculo) ?? inicial),
      );
    };
    calcula();
    const id = setInterval(calcula, 60_000);
    return () => clearInterval(id);
  }, [chave, grade, inicial, minusculo]);

  return <>{texto}</>;
}
