import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { server } from '@/mocks/server';
import type { VersionDto } from '../types';
import { DocumentViewer } from './DocumentViewer';

// pdf.js a besoin d'un vrai canvas : on vérifie seulement ce que la visionneuse reçoit
vi.mock('./viewer/PdfViewer', () => ({
  default: ({ url, label, trailing }: { url: string; label: string; trailing?: ReactNode }) => (
    <div role="document" aria-label={label} data-url={url}>
      {trailing}
    </div>
  ),
}));

const version = (n: number, mimeType: string, filename: string): VersionDto => ({
  versionNo: n,
  filename,
  mimeType,
  sizeBytes: 2048,
  sha256: 'ab'.repeat(32),
  replaceReason: null,
  createdBy: 'K. Benali',
  createdAt: '2026-11-22T10:00:00Z',
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function viewLinkReturns(body: object) {
  server.use(http.post('*/api/documents/:id/versions/:n/view-link', () => HttpResponse.json(body)));
}

describe('DocumentViewer', () => {
  it('ouvre un PDF dans la visionneuse pdf.js, avec le lien signé', async () => {
    viewLinkReturns({
      url: '/api/documents/d1/versions/2/view?token=abc',
      mimeType: 'application/pdf',
      previewable: true,
      expiresAt: null,
    });
    render(
      <DocumentViewer documentId="d1" title="Facture" versions={[version(2, 'application/pdf', 'f.pdf')]} />,
      { wrapper },
    );

    const doc = await screen.findByRole('document', { name: 'Aperçu de « Facture », version 2' });
    expect(doc).toHaveAttribute('data-url', '/api/documents/d1/versions/2/view?token=abc');
    expect(screen.getByRole('link', { name: /nouvel onglet/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('affiche une image avec un texte alternatif, zoomable et orientable', async () => {
    viewLinkReturns({
      url: '/api/x/view?token=t',
      mimeType: 'image/png',
      previewable: true,
      expiresAt: null,
    });
    const user = userEvent.setup();
    render(<DocumentViewer documentId="d1" title="Plan" versions={[version(1, 'image/png', 'plan.png')]} />, {
      wrapper,
    });
    const img = await screen.findByRole('img', { name: 'Aperçu de « Plan », version 1' });
    expect(img).toHaveAttribute('src', '/api/x/view?token=t');

    await user.click(screen.getByRole('button', { name: 'Pivoter' }));
    expect(img.style.transform).toBe('rotate(90deg)');
    // Ajustée à la zone par défaut ; un zoom la quitte
    const fit = screen.getByRole('button', { name: 'Page entière' });
    expect(fit).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Zoom avant' }));
    expect(fit).toHaveAttribute('aria-pressed', 'false');
  });

  it("n'affiche pas un format que le navigateur ne doit pas interpréter", async () => {
    viewLinkReturns({ url: null, mimeType: 'text/html', previewable: false, expiresAt: null });
    render(
      <DocumentViewer documentId="d1" title="Page" versions={[version(1, 'text/html', 'page.html')]} />,
      { wrapper },
    );
    expect(await screen.findByText('Aperçu impossible pour ce format')).toBeInTheDocument();
    expect(screen.queryByRole('document')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nouvel onglet/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Télécharger/ })).toBeEnabled();
  });

  it('propose de changer de version quand il y en a plusieurs', async () => {
    viewLinkReturns({ url: '/api/v', mimeType: 'application/pdf', previewable: true, expiresAt: null });
    const onVersionChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DocumentViewer
        documentId="d1"
        title="Contrat"
        versions={[version(2, 'application/pdf', 'c2.pdf'), version(1, 'application/pdf', 'c1.pdf')]}
        onVersionChange={onVersionChange}
      />,
      { wrapper },
    );
    await screen.findByRole('document');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Version' }), '1');
    expect(onVersionChange).toHaveBeenCalledWith(1);
  });
});
