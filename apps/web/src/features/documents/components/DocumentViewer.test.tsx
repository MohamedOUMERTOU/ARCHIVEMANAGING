import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { server } from '@/mocks/server';
import type { VersionDto } from '../types';
import { DocumentViewer } from './DocumentViewer';

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
  it('affiche un PDF dans un cadre titré, avec le lien signé', async () => {
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

    const frame = await screen.findByTitle('Aperçu de « Facture », version 2');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', '/api/documents/d1/versions/2/view?token=abc');
    expect(screen.getByRole('link', { name: /nouvel onglet/i })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('affiche une image avec un texte alternatif', async () => {
    viewLinkReturns({
      url: '/api/x/view?token=t',
      mimeType: 'image/png',
      previewable: true,
      expiresAt: null,
    });
    render(<DocumentViewer documentId="d1" title="Plan" versions={[version(1, 'image/png', 'plan.png')]} />, {
      wrapper,
    });
    expect(await screen.findByRole('img', { name: 'Aperçu de « Plan », version 1' })).toHaveAttribute(
      'src',
      '/api/x/view?token=t',
    );
  });

  it("n'affiche pas un format que le navigateur ne doit pas interpréter", async () => {
    viewLinkReturns({ url: null, mimeType: 'text/html', previewable: false, expiresAt: null });
    render(
      <DocumentViewer documentId="d1" title="Page" versions={[version(1, 'text/html', 'page.html')]} />,
      { wrapper },
    );
    expect(await screen.findByText('Aperçu impossible pour ce format')).toBeInTheDocument();
    expect(screen.queryByTitle(/Aperçu de/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Télécharger/ })).toBeEnabled();
  });
});
