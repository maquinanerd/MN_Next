import type { Patrocinado } from '@mn/ui';

/**
 * "Conteúdo patrocinado" — demonstration items for fixture mode only.
 *
 * There is no partner feed yet: in production the grid renders nothing until a native ad
 * source is connected (docs/migration/RUNBOOK.md). These exist so the offer template can
 * be reviewed against its prototype. Titles are the prototype's; they link to the
 * advertising page because a demo must not send a reader to a real store.
 */
export const PATROCINADOS_DEMO: Patrocinado[] = [
  {
    id: 'demo-1',
    href: '/anuncie',
    titulo: 'Cadeiras gamer com até 30% de desconto nesta semana',
    imagem: { url: '/fixtures/cover-07.jpg', alt: '', largura: 1600, altura: 900 },
    parceiro: 'Parceiro · Patrocinado',
  },
  {
    id: 'demo-2',
    href: '/anuncie',
    titulo: 'SSD NVMe 1TB: os modelos mais buscados de setembro',
    imagem: { url: '/fixtures/cover-05.jpg', alt: '', largura: 1600, altura: 900 },
    parceiro: 'Parceiro · Patrocinado',
  },
  {
    id: 'demo-3',
    href: '/anuncie',
    titulo: 'Monitores 144Hz para quem joga no PC',
    imagem: { url: '/fixtures/cover-04.jpg', alt: '', largura: 1600, altura: 900 },
    parceiro: 'Parceiro · Patrocinado',
  },
  {
    id: 'demo-4',
    href: '/anuncie',
    titulo: 'Headsets sem fio: guia rápido de compra',
    imagem: { url: '/fixtures/cover-06.jpg', alt: '', largura: 1600, altura: 900 },
    parceiro: 'Parceiro · Patrocinado',
  },
];
