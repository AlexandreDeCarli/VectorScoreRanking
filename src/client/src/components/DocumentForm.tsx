import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

interface DocumentFormProps {
  documentId: number | null;
  onClose: () => void;
  onSave: () => void;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({ documentId, onClose, onSave }) => {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (documentId !== null) {
      loadDocument(documentId);
    }
  }, [documentId]);

  const loadDocument = async (id: number) => {
    setFetching(true);
    setError(null);
    try {
      const doc = await api.getDocument(id);
      setTitulo(doc.titulo);
      setConteudo(doc.conteudo);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar documento');
    } finally {
      setFetching(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Suggest title from filename (removing extension)
    const suggestedTitle = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setTitulo(suggestedTitle);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setConteudo(text || '');
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo selecionado.');
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (documentId !== null) {
        await api.updateDocument(documentId, titulo, conteudo);
      } else {
        await api.createDocument(titulo, conteudo);
      }
      onSave();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar documento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-card modal-content">
        <div className="modal-header">
          <h2>{documentId !== null ? 'Alterar Documento' : 'Inserir Documento'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {fetching ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Carregando dados...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Upload Area for New Files */}
            {documentId === null && (
              <div className="file-dropzone" onClick={() => document.getElementById('fileInput')?.click()}>
                <input
                  type="file"
                  id="fileInput"
                  style={{ display: 'none' }}
                  accept=".txt,.md,.json,.html,.xml,.csv"
                  onChange={handleFileUpload}
                />
                <div style={{ fontSize: '2rem', color: 'var(--accent-color)' }}>📁</div>
                <p>Arraste ou clique para fazer upload de um arquivo de texto (.txt, .md, etc.)</p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="titulo">Título</label>
              <input
                type="text"
                id="titulo"
                className="form-control"
                placeholder="Título do documento"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="conteudo">Conteúdo do Documento (Texto)</label>
              <textarea
                id="conteudo"
                className="form-control"
                placeholder="Escreva ou cole o conteúdo do documento aqui..."
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="loading-spinner"></span> : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
