import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DocumentForm } from './DocumentForm';

interface DashboardProps {
  onLogout: () => void;
}

interface DocumentMeta {
  id: number;
  titulo: string;
  created_at: string;
}

interface SearchResult {
  id: number;
  titulo: string;
  conteudo: string;
  similarity: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    setError(null);
    try {
      const docs = await api.listDocuments();
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lista de documentos');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Deseja realmente excluir o documento "${title}"?`)) return;
    setError(null);
    try {
      await api.deleteDocument(id);
      loadDocuments();
      // Remove from search results if present
      setSearchResults(prev => prev.filter(res => res.id !== id));
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir documento');
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    setError(null);
    try {
      const results = await api.search(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar vetores');
    } finally {
      setSearching(false);
    }
  };

  const handleOpenCreateForm = () => {
    setActiveDocId(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (id: number) => {
    setActiveDocId(id);
    setIsFormOpen(true);
  };

  const handleSaveSuccess = () => {
    setIsFormOpen(false);
    loadDocuments();
  };

  const formatScore = (similarity: number) => {
    const percentage = Math.max(0, Math.min(100, similarity * 100));
    return `${percentage.toFixed(1)}%`;
  };

  return (
    <div>
      <header className="app-header">
        <div className="header-container">
          <h1>VectorScore</h1>
          <div className="user-controls">
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Logado como Admin</span>
            <button className="btn btn-secondary" onClick={onLogout}>Sair</button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="dashboard-grid">
          {/* Left Side: Document List */}
          <div>
            <div className="section-title">
              <h2>Documentos Salvos ({documents.length})</h2>
              <button className="btn btn-primary" onClick={handleOpenCreateForm}>+ Novo Documento</button>
            </div>

            {loadingDocs ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Carregando documentos...</div>
            ) : documents.length === 0 ? (
              <div className="glass-card empty-state">
                <p>Nenhum documento cadastrado no banco de dados.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '10px' }}>
                  Clique em "+ Novo Documento" para inserir o primeiro texto e gerar seu embedding.
                </p>
              </div>
            ) : (
              <div className="document-list">
                {documents.map((doc) => (
                  <div key={doc.id} className="glass-card document-item">
                    <div className="doc-info">
                      <h3>{doc.titulo}</h3>
                      <div className="doc-meta">
                        Criado em: {new Date(doc.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    <div className="doc-actions">
                      <button className="btn btn-secondary btn-icon" title="Editar" onClick={() => handleOpenEditForm(doc.id)}>
                        ✏️
                      </button>
                      <button className="btn btn-danger btn-icon" title="Excluir" onClick={() => handleDelete(doc.id, doc.titulo)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Vector Search */}
          <div>
            <div className="section-title">
              <h2>Busca por Semelhança (Vetores)</h2>
            </div>

            <div className="glass-card search-panel">
              <form onSubmit={handleSearchSubmit} className="search-box">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Pesquise conceitos, temas, significados..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  required
                  disabled={searching}
                />
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? <span className="loading-spinner"></span> : '🔍 Buscar'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="results-list">
                  <div className="doc-meta" style={{ marginBottom: '10px' }}>
                    Resultados ranqueados por aproximação de cosseno:
                  </div>
                  {searchResults.map((res) => {
                    const isHigh = res.similarity >= 0.7;
                    return (
                      <div key={res.id} className="result-item">
                        <div className="result-header">
                          <h4>{res.titulo}</h4>
                          <span className={`score-badge ${isHigh ? 'score-high' : ''}`}>
                            {formatScore(res.similarity)}
                          </span>
                        </div>
                        <div className="result-body">{res.conteudo}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchResults.length === 0 && searchQuery && !searching && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  Nenhum resultado retornado para a busca.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Document Create/Edit Modal */}
      {isFormOpen && (
        <DocumentForm
          documentId={activeDocId}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
};
