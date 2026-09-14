import { assinatura, dataCurta, relativa, type Chamada } from '@mn/ui';

/**
 * The small texts under and above a headline, as the prototypes write them:
 *   "24 minutos atrás" · "6 horas atrás | Animes" · "Por Rafael Lima · 5 horas atrás".
 * One place, so every surface says the same thing the same way.
 */

export function tempo(c: Chamada, now: Date, comEditoria = false): string {
  const when = relativa(c.publicadoEm, now);
  return comEditoria ? `${when} | ${c.editoria.nome}` : when;
}

export function porQuem(c: Chamada, now: Date): string {
  const by = assinatura((c.autores ?? []).map((a) => a.nome));
  const when = relativa(c.publicadoEm, now);
  return by ? `${by} · ${when}` : when;
}

export function data(c: Chamada): string {
  return dataCurta(c.publicadoEm);
}

/** The label: the subject when there is one ("Marvel"), else the editoria. */
export function rotulo(c: Chamada): string {
  return c.assunto ?? c.editoria.nome;
}

/** "Animes | Lançamentos" */
export function rotuloComposto(c: Chamada): string {
  return c.assunto ? `${c.editoria.nome} | ${c.assunto}` : c.editoria.nome;
}
