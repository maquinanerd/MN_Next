import Image from "next/image";
import type { Imagem } from "@/lib/content/types";

/**
 * Foto editorial preenchendo o quadro (o pai define proporção e `position`). Dentro de um
 * card-link o título já nomeia o link, então a foto é decorativa (`alt=""`); fora disso,
 * passe `descritiva`.
 */
export function Foto({
  imagem,
  sizes,
  eager = false,
  descritiva = false,
  className = "",
}: {
  imagem?: Imagem;
  sizes: string;
  eager?: boolean;
  descritiva?: boolean;
  className?: string;
}) {
  if (!imagem) return null;
  return (
    <Image
      src={imagem.url}
      alt={descritiva ? imagem.alt : ""}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      className={`object-cover ${className}`}
    />
  );
}
