import { absoluteUrl } from "@/lib/site";
import { ShareNative } from "./ShareNative";

/**
 * Círculos de 30px do protótipo ("in", "f", "X", "G"); G envia por e-mail. O nome acessível
 * começa pelo glifo visível, para quem usa comando de voz (WCAG 2.5.3).
 */
export function ShareButtons({
  path,
  titulo,
  comNativo = false,
}: {
  path: string;
  titulo: string;
  comNativo?: boolean;
}) {
  const url = absoluteUrl(path);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);
  const itens = [
    {
      glyph: "in",
      label: "in: compartilhar no LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    },
    {
      glyph: "f",
      label: "f: compartilhar no Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    },
    { glyph: "X", label: "X: compartilhar no X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { glyph: "G", label: "G: compartilhar por e-mail", href: `mailto:?subject=${t}&body=${u}` },
  ];
  return (
    <div className="flex flex-none items-center gap-1.5">
      {itens.map((s) => (
        <a
          key={s.glyph}
          href={s.href}
          aria-label={s.label}
          target={s.href.startsWith("http") ? "_blank" : undefined}
          rel={s.href.startsWith("http") ? "noopener" : undefined}
          className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border border-mn-line-3 text-[10px] font-bold text-mn-ink before:absolute before:-inset-1 before:content-['']"
        >
          {s.glyph}
        </a>
      ))}
      {comNativo && <ShareNative url={url} titulo={titulo} />}
    </div>
  );
}
