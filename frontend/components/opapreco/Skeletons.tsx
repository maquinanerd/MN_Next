import type { AdComponent } from "@/lib/ads/types";

/**
 * Estado "loading" (spec §7): a mesma geometria do componente, blocos #EEE e pulso opcional
 * (desligado com prefers-reduced-motion). Reaproveita as classes de layout dos componentes,
 * então a altura do esqueleto acompanha a do anúncio que vai ocupar o lugar.
 */
export function Skeleton({
  component,
  alinharAoSite = false,
}: {
  component: AdComponent;
  alinharAoSite?: boolean;
}) {
  switch (component) {
    case "product_card_v1":
      return (
        <div aria-hidden="true" className="op-skel op-boxed op-card">
          <i className="op-img" />
          <div className="op-card__body" style={{ gap: 10 }}>
            <i style={{ width: "45%", height: 12 }} />
            <i style={{ width: "90%", height: 16 }} />
            <i style={{ width: "60%", height: 16 }} />
            <i style={{ width: "35%", height: 26 }} />
            <div style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}>
              <i style={{ width: 200, maxWidth: "100%", height: 44, borderRadius: 6 }} />
            </div>
          </div>
        </div>
      );
    case "product_compact_v1":
      return (
        <div aria-hidden="true" className="op-skel op-boxed op-compact">
          <i className="op-img" />
          <div className="op-compact__body" style={{ gap: 8 }}>
            <i style={{ width: "70%", height: 12 }} />
            <i style={{ width: "30%", height: 18 }} />
          </div>
          <i style={{ flex: "0 0 96px", height: 44, borderRadius: 6 }} />
        </div>
      );
    case "product_hero_v1":
      return (
        <div aria-hidden="true" className="op-skel op-boxed op-hero">
          <i className="op-img" style={{ borderRadius: 0 }} />
          <div className="op-hero__body">
            <i style={{ width: "50%", height: 12 }} />
            <i style={{ width: "90%", height: 18 }} />
            <i style={{ width: "40%", height: 32 }} />
            <i style={{ height: 64, borderRadius: 8, background: "#F4F4F4" }} />
            <i style={{ height: 48, borderRadius: 6, marginTop: "auto" }} />
          </div>
        </div>
      );
    case "price_drop_v1":
      return (
        <div aria-hidden="true" className="op-skel op-boxed op-drop">
          <i style={{ width: "30%", height: 14 }} />
          <div className="op-drop__row">
            <i className="op-img" />
            <div className="op-drop__body" style={{ gap: 10 }}>
              <i style={{ width: "85%", height: 16 }} />
              <i style={{ width: "40%", height: 28 }} />
              <i style={{ height: 44, borderRadius: 6, marginTop: "auto" }} />
            </div>
          </div>
        </div>
      );
    case "contextual_recommendation_v1":
      return (
        <div aria-hidden="true" className="op-skel op-ctx" style={{ borderTopColor: "#E6E6E6" }}>
          <i style={{ width: "35%", height: 12 }} />
          <i style={{ width: "70%", height: 20 }} />
          <i style={{ width: "90%", height: 15 }} />
          <i style={{ height: 112, borderRadius: 8, background: "#F4F4F4" }} />
        </div>
      );
    case "product_grid_v1":
      return (
        <div aria-hidden="true" className={`op-skel op-grid${alinharAoSite ? " op-grid--site" : ""}`}>
          <i style={{ width: "40%", height: 18 }} />
          <div className="op-grid__list">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="op-boxed op-grid__item" style={{ background: "#FAFAFA" }}>
                <i className="op-img" />
                <i style={{ width: "90%", height: 40 }} />
                <i style={{ width: "50%", height: 24 }} />
                <i style={{ height: 44, borderRadius: 6, marginTop: "auto" }} />
              </div>
            ))}
          </div>
        </div>
      );
  }
}
