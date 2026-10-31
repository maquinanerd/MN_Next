import { describe, expect, it } from "vitest";
import { jsonLdScript } from "./jsonld";

describe("jsonLdScript", () => {
  it("não deixa um título fechar a tag <script>", () => {
    const { __html } = jsonLdScript({ headline: "</script><script>alert(1)</script> & <!--" });
    expect(__html).not.toMatch(/[<>&]/);
    expect(__html).toContain("\\u003c/script\\u003e");
  });

  it("continua sendo JSON válido com o mesmo conteúdo", () => {
    const data = { headline: "Ação & reação <b>", sep: "a\u2028b" };
    expect(JSON.parse(jsonLdScript(data).__html)).toEqual(data);
  });
});
