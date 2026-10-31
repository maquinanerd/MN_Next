import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { contentSource } from "../mode";
import type { ContentAdapter } from "./adapter";
import { cmsAdapter } from "./cms";
import { fixtureAdapter } from "./fixtures";
import type { EditoriaSlug } from "./types";

/**
 * Leituras de conteúdo com cache por tag. As páginas só falam com estas funções; trocar
 * fixtures por CMS é trocar o adaptador abaixo. `Date.now()` só é lido dentro do escopo
 * em cache, como exige o Cache Components.
 */
function adapter(): ContentAdapter {
  return contentSource() === "cms" ? cmsAdapter() : fixtureAdapter(Date.now());
}

export async function getHome() {
  "use cache";
  cacheLife("minutes");
  cacheTag("home");
  return adapter().home();
}

export async function getFeed(pagina: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("home", "feed");
  return adapter().feed(pagina);
}

export async function getEditoria(slug: EditoriaSlug, pagina: number, assunto?: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`editoria:${slug}`);
  return adapter().editoria(slug, { pagina, assunto });
}

export async function getMateria(editoria: string, slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`materia:${slug}`);
  return adapter().materia(editoria, slug);
}

export async function getOferta(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`materia:${slug}`);
  return adapter().oferta(slug);
}

export async function getOfertasLista() {
  "use cache";
  cacheLife("minutes");
  cacheTag("ofertas");
  return adapter().ofertas();
}

export async function searchContent(q: string, pagina: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag("busca");
  return adapter().busca(q, pagina);
}

export async function listMaterias() {
  "use cache";
  cacheLife("hours");
  cacheTag("materias");
  return adapter().todas();
}
