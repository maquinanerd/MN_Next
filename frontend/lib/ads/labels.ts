/**
 * Rótulos de verificação de preço (spec §4 e §12), sem dependências: usados no servidor e
 * recalculados no navegador, para a página em cache não dizer "verificado agora" uma hora
 * depois.
 */

/** "Preço verificado agora" · "há 12 min" · "há 3 h". Acima de 6 h: null (não servir). */
export function checkedLabel(checkedAt: string, now: number, lower = false): string | null {
  const min = Math.max(0, Math.floor((now - Date.parse(checkedAt)) / 60_000));
  if (min > 6 * 60) return null;
  const p = lower ? "preço verificado" : "Preço verificado";
  if (min < 1) return `${p} agora`;
  if (min < 60) return `${p} há ${min} min`;
  return `${p} há ${Math.floor(min / 60)} h`;
}

/** Rodapé da grade: "Preços na Shopee, verificados há até 25 min." (pela oferta mais antiga). */
export function gridFootLabel(checkedAts: string[], merchant: string, now: number): string {
  const oldest = Math.max(0, ...checkedAts.map((c) => Math.floor((now - Date.parse(c)) / 60_000)));
  if (oldest < 1) return `Preços na ${merchant}, verificados agora.`;
  if (oldest < 60) return `Preços na ${merchant}, verificados há até ${oldest} min.`;
  return `Preços na ${merchant}, verificados há até ${Math.floor(oldest / 60)} h.`;
}
