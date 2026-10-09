export interface RAGDocument {
  doc_id: string;
  title: string;
  airline?: string | null;
  airline_code?: string | null;
  airport?: string | null;
  policy_type?: string | null;
  source_url?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  verified?: boolean;
  total_chunks?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ScoredChunk {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  chunk: {
    chunk_id: string;
    doc_id: string;
    content: string;
    metadata: {
      title: string;
      airline?: string | null;
      airline_code?: string | null;
      airport?: string | null;
      section?: string | null;
      source_url?: string | null;
      verified?: boolean;
    };
  };
}

export interface AskQuestionResponse {
  question: string;
  answer: string;
  sources: Array<{
    name: string;
    type?: string;
    source_url?: string;
    verified?: boolean;
    confidence?: string;
    relevance_score?: number;
  }>;
  chunks: ScoredChunk[];
  source_type?: 'rag' | 'web_search' | 'hybrid';
  latency_ms: number;
}

export interface RAGStats {
  rag_enabled: boolean;
  embedding_provider: string;
  embedding_model: string;
  store_backend: string;
  total_documents: number;
  total_chunks: number;
  cache_size: number;
  cache_capacity: number;
  cache_hits: number;
  cache_misses: number;
  similarity_threshold: number;
  top_k: number;
}
