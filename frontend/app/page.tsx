import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader active="noticias" />
      <main className="mn-wrap min-h-[60vh] pt-10" />
      <SiteFooter />
    </>
  );
}
