import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Dashboard } from '../components/Dashboard';
import { api } from '../utils/api';

// Mock the API module
vi.mock('../utils/api', () => ({
  api: {
    listDocuments: vi.fn(),
    deleteDocument: vi.fn(),
    search: vi.fn(),
  },
}));

// Mock the DocumentForm subcomponent to avoid loading dependencies
vi.mock('../components/DocumentForm', () => ({
  DocumentForm: ({ documentId, onClose, onSave }: any) => (
    <div data-testid="mock-document-form">
      <span>Mock Form {documentId}</span>
      <button onClick={onSave}>Save mock</button>
      <button onClick={onClose}>Close mock</button>
    </div>
  ),
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render headers and title sections', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    
    render(<Dashboard onLogout={() => {}} />);
    
    expect(screen.getByText('VectorScore')).toBeInTheDocument();
    expect(screen.getByText('Logado como Admin')).toBeInTheDocument();
    expect(screen.getByText('Busca por Semelhança (Vetores)')).toBeInTheDocument();
  });

  it('should render empty state when no documents exist', async () => {
    (api.listDocuments as any).mockResolvedValue([]);

    render(<Dashboard onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum documento cadastrado no banco de dados.')).toBeInTheDocument();
    });
  });

  it('should render document list when documents exist', async () => {
    (api.listDocuments as any).mockResolvedValue([
      { id: 1, titulo: 'Primeiro Documento', created_at: '2026-06-05T12:00:00Z' },
      { id: 2, titulo: 'Segundo Documento', created_at: '2026-06-05T13:00:00Z' },
    ]);

    render(<Dashboard onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Primeiro Documento')).toBeInTheDocument();
      expect(screen.getByText('Segundo Documento')).toBeInTheDocument();
    });
  });

  it('should call api.search and render results on search submit', async () => {
    (api.listDocuments as any).mockResolvedValue([]);
    (api.search as any).mockResolvedValue([
      { id: 1, titulo: 'Resultado da Busca 1', conteudo: 'Exemplo de texto 1', similarity: 0.852 }
    ]);

    render(<Dashboard onLogout={() => {}} />);

    const searchInput = screen.getByPlaceholderText(/Pesquise conceitos/i);
    const searchBtn = screen.getByRole('button', { name: /Buscar/i });

    fireEvent.change(searchInput, { target: { value: 'inteligência artificial' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(api.search).toHaveBeenCalledWith('inteligência artificial');
      expect(screen.getByText('Resultado da Busca 1')).toBeInTheDocument();
      expect(screen.getByText('Exemplo de texto 1')).toBeInTheDocument();
      expect(screen.getByText('85.2%')).toBeInTheDocument();
    });
  });

  it('should open create modal when clicking new document', async () => {
    (api.listDocuments as any).mockResolvedValue([]);

    render(<Dashboard onLogout={() => {}} />);

    const newBtn = screen.getByRole('button', { name: /\+ Novo Documento/i });
    fireEvent.click(newBtn);

    expect(screen.getByTestId('mock-document-form')).toBeInTheDocument();
  });
});
