import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Máquina Nerd — cinema, séries e TV, games, quadrinhos e animes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FAIXAS = ["#E30613", "#A248FC", "#5075FC", "#F2CF51", "#EA8D49", "#64D56F", "#68B3F7", "#1E1E1E"];

/** Imagem social padrão: fundo preto, logo para fundo escuro e os filetes das editorias. */
export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public", "logo-on-dark.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0D0D0D",
        }}
      >
        <div style={{ display: "flex", height: 12 }}>
          {FAIXAS.map((c) => (
            <div key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renderiza <img>, não next/image */}
          <img src={src} width={801} height={195} alt="" />
        </div>
      </div>
    ),
    size,
  );
}
