'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import {
  UploadCloud,
  FileText,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Search,
  Database,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  getRAGStats,
  getRAGDocuments,
  uploadRAGDocument,
  deleteRAGDocument,
  askRagQuestion,
} from '@/lib/api/client';
import type { RAGDocument, RAGStats, AskQuestionResponse } from '@/types/rag';

const POLICY_TYPES = [
  { value: 'CARRIER_CONDITIONS_OF_CARRIAGE', label: 'Conditions of Carriage' },
  { value: 'REGULATORY_COMPENSATION', label: 'Regulatory Rights (EU261, APPR, etc.)' },
  { value: 'AIRPORT_MCT_RULE', label: 'Airport Minimum Connection Time (MCT)' },
  { value: 'INTERLINE_AGREEMENT', label: 'Interline & Baggage Agreement' },
  { value: 'GENERAL_POLICY', label: 'General Airline Policy' },
];

export default function AdminPortalPage() {
  const { user, token, isAdmin, isLoading: authLoading } = useAuth();

  // Knowledge base state
  const [stats, setStats] = useState<RAGStats | null>(null);
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [airlineName, setAirlineName] = useState('');
  const [airlineCode, setAirlineCode] = useState('');
  const [airportCode, setAirportCode] = useState('');
  const [policyType, setPolicyType] = useState('CARRIER_CONDITIONS_OF_CARRIAGE');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search/Filter documents
  const [searchFilter, setSearchFilter] = useState('');

  // RAG Testing state
  const [testQuery, setTestQuery] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<AskQuestionResponse | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch initial data
  const refreshData = async () => {
    setErrorNotice(null);
    setLoadingStats(true);
    setLoadingDocs(true);

    try {
      const statsRes = await getRAGStats();
      setStats(statsRes);
    } catch (err: any) {
      console.error('Failed to load RAG stats:', err);
    } finally {
      setLoadingStats(false);
    }

    try {
      const docsRes = await getRAGDocuments();
      setDocuments(docsRes);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setErrorNotice('Could not load documents from Supabase. Ensure backend is running.');
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      refreshData();
    }
  }, [isAdmin]);

  // Handle document upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorNotice('Please select a PDF, TXT, or MD document to upload.');
      return;
    }

    setUploading(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (docTitle.trim()) formData.append('title', docTitle.trim());
    if (airlineName.trim()) formData.append('airline', airlineName.trim());
    if (airlineCode.trim()) formData.append('airline_code', airlineCode.trim().toUpperCase());
    if (airportCode.trim()) formData.append('airport', airportCode.trim().toUpperCase());
    formData.append('policy_type', policyType);

    try {
      const result = await uploadRAGDocument(formData, token || undefined);
      setSuccessNotice(`Document "${selectedFile.name}" indexed successfully (${result.chunks_created || 0} chunks created in Supabase pgvector).`);
      
      // Reset upload form
      setSelectedFile(null);
      setDocTitle('');
      setAirlineName('');
      setAirlineCode('');
      setAirportCode('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh list
      await refreshData();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to upload and index document.');
    } finally {
      setUploading(false);
    }
  };

  // Handle document deletion
  const handleDelete = async (docId: string, title?: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete "${title || docId}"? This will remove the file from Supabase Storage and delete all vectorized chunks in pgvector.`);
    if (!confirmDelete) return;

    setDeletingId(docId);
    setErrorNotice(null);
    setSuccessNotice(null);

    try {
      await deleteRAGDocument(docId, token || undefined);
      setSuccessNotice(`Document successfully removed from Supabase and vector store.`);
      await refreshData();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  // Test RAG Retrieval
  const handleTestAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setTestLoading(true);
    setTestResult(null);

    try {
      const res = await askRagQuestion(testQuery.trim(), 3, 0.15);
      setTestResult(res);
    } catch (err: any) {
      setErrorNotice(err.message || 'RAG query failed.');
    } finally {
      setTestLoading(false);
    }
  };

  // Access Control Guard
  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="eyebrow text-ink-muted">Verifying administrator clearance...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="surface p-8 sm:p-12 max-w-2xl mx-auto my-12 text-center space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-danger-bg text-status-danger mx-auto">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <p className="eyebrow text-status-danger">Restricted Area</p>
          <h1 className="display text-3xl sm:text-4xl text-ink">Administrator Clearance Required</h1>
          <p className="text-base text-ink-soft max-w-md mx-auto">
            You are signed in as a passenger account ({user?.email || 'Guest'}). The Knowledge Base and policy management portal is restricted to authorized administrative personnel.
          </p>
        </div>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-sand-50 transition-colors hover:bg-ink-soft"
          >
            Go to Passenger Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/20 px-6 text-sm font-medium text-ink transition-colors hover:border-ink/40"
          >
            Sign in as Admin
          </Link>
        </div>
      </div>
    );
  }

  const filteredDocs = documents.filter((doc) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(q) ||
      doc.airline?.toLowerCase().includes(q) ||
      doc.airline_code?.toLowerCase().includes(q) ||
      doc.doc_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-12 sm:space-y-16">
      <PageHeader
        eyebrow="Admin Portal / Supabase Knowledge Base"
        title="Policy documents &"
        accent="knowledge store."
        description="Upload airline conditions of carriage, regulatory rules, and minimum connection times. Documents are stored in Supabase Storage and vectorized into pgvector (768d)."
        actions={
          <Button variant="outline" onClick={refreshData} disabled={loadingStats || loadingDocs}>
            <RefreshCw className={`h-4 w-4 ${loadingStats || loadingDocs ? 'animate-spin' : ''}`} />
            Sync with Supabase
          </Button>
        }
      />

      {/* Notifications */}
      {successNotice && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-status-safe/30 bg-status-safe-bg p-4 text-status-safe">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">{successNotice}</p>
        </div>
      )}

      {errorNotice && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-status-danger/30 bg-status-danger-bg p-4 text-status-danger">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium leading-relaxed">{errorNotice}</p>
        </div>
      )}

      {/* SECTION 1: SYSTEM & VECTOR STATS */}
      <section aria-labelledby="stats-heading" className="space-y-4">
        <h2 id="stats-heading" className="eyebrow flex items-center gap-2">
          <Database className="h-4 w-4 text-coral" />
          <span>System & Vector Store Telemetry</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Vector Store Backend</p>
            <p className="display text-3xl text-ink font-semibold">{stats?.backend || 'pgvector'}</p>
            <p className="text-xs text-ink-soft">Supabase PostgreSQL + pgvector</p>
          </div>

          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Indexed Chunks</p>
            <p className="display text-3xl text-coral font-semibold">{stats?.total_chunks ?? '...'}</p>
            <p className="text-xs text-ink-soft">Cosine similarity indexed (768d)</p>
          </div>

          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Total Documents</p>
            <p className="display text-3xl text-ink font-semibold">{documents.length}</p>
            <p className="text-xs text-ink-soft">In Supabase Storage bucket</p>
          </div>

          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Verified Status</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="flex h-3 w-3 rounded-full bg-status-safe animate-pulse" />
              <span className="text-base font-medium text-ink">Connected & Ready</span>
            </div>
            <p className="text-xs text-ink-soft">Admin: {user?.email}</p>
          </div>
        </div>
      </section>

      {/* SECTION 2: DOCUMENT INGESTION FORM */}
      <section aria-labelledby="upload-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="upload-heading" className="eyebrow flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-coral" />
            <span>Ingest Document into Knowledge Base</span>
          </h2>
          <p className="text-sm text-ink-soft">
            Upload PDF or text documents. Text will be extracted, split into semantic chunks, embedded via 768-dim vectorizer, and linked to Supabase Storage.
          </p>
        </div>

        <form onSubmit={handleUpload} className="surface p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="eyebrow block mb-2">Select Policy Document (.pdf, .txt, .md)</label>
                <div className="border-2 border-dashed border-ink/20 rounded-2xl p-6 text-center hover:border-coral transition-colors bg-sand-50/50">
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="doc-file-upload"
                    accept=".pdf,.txt,.md,text/plain,application/pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="doc-file-upload" className="cursor-pointer block space-y-2">
                    <FileText className="h-10 w-10 text-coral mx-auto" />
                    <span className="block text-sm font-medium text-ink">
                      {selectedFile ? selectedFile.name : 'Click to browse or drop file here'}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'PDF, Plain Text, or Markdown (Max 25MB)'}
                    </span>
                  </label>
                </div>
              </div>

              <Input
                id="doc-title"
                label="Document Title"
                placeholder="e.g. SriLankan Airlines General Conditions of Carriage"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                helperText="Defaults to filename if left empty."
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="airline-name"
                  label="Airline Name"
                  placeholder="e.g. SriLankan Airlines"
                  value={airlineName}
                  onChange={(e) => setAirlineName(e.target.value)}
                />
                <Input
                  id="airline-code"
                  label="Airline Code (IATA)"
                  placeholder="e.g. UL"
                  value={airlineCode}
                  onChange={(e) => setAirlineCode(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="airport-code"
                  label="Airport Code (Optional)"
                  placeholder="e.g. CMB or KUL"
                  value={airportCode}
                  onChange={(e) => setAirportCode(e.target.value)}
                />

                <div className="space-y-2">
                  <label htmlFor="policy-type" className="eyebrow block">
                    Policy Classification
                  </label>
                  <select
                    id="policy-type"
                    value={policyType}
                    onChange={(e) => setPolicyType(e.target.value)}
                    className="h-12 w-full rounded-xl border border-ink/15 bg-sand-50 px-3 text-sm text-ink focus:border-ink focus:outline-none"
                  >
                    {POLICY_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={uploading || !selectedFile}>
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Parsing, Embedding & Storing in Supabase...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Upload to Supabase Storage & Index
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* SECTION 3: DOCUMENT LIBRARY */}
      <section aria-labelledby="library-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 id="library-heading" className="eyebrow flex items-center gap-2">
              <Layers className="h-4 w-4 text-coral" />
              <span>Knowledge Base Document Library</span>
            </h2>
            <p className="text-sm text-ink-soft">
              {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'} indexed in PostgreSQL pgvector.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Filter by title, airline or code..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-ink/15 bg-sand-50 pl-9 pr-3 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </div>
        </div>

        {loadingDocs ? (
          <div className="surface p-12 text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-coral mx-auto" />
            <p className="text-sm text-ink-soft">Loading indexed documents from Supabase...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="surface p-12 text-center space-y-3">
            <FileText className="h-8 w-8 text-ink-muted mx-auto" />
            <p className="text-base font-semibold text-ink">No documents match your search</p>
            <p className="text-sm text-ink-soft">Upload a policy document using the form above to add it to the RAG knowledge store.</p>
          </div>
        ) : (
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-sand-100/50">
                    <th className="eyebrow px-6 py-4 font-normal">Document & Airline</th>
                    <th className="eyebrow px-6 py-4 font-normal">Classification</th>
                    <th className="eyebrow px-6 py-4 font-normal">Chunks</th>
                    <th className="eyebrow px-6 py-4 font-normal">Storage Path</th>
                    <th className="eyebrow px-6 py-4 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.doc_id} className="hover:bg-sand-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-ink text-base">{doc.title}</p>
                          <div className="flex items-center gap-2 text-xs text-ink-muted">
                            {doc.airline && <span className="font-medium text-coral">{doc.airline}</span>}
                            {doc.airline_code && <span className="font-mono">({doc.airline_code})</span>}
                            {doc.airport && <span>· Airport {doc.airport}</span>}
                            <span>· ID: {doc.doc_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-sand-200 px-3 py-1 text-xs font-mono font-medium text-ink-soft">
                          {doc.policy_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-ink">
                        {doc.chunk_count || '1+'} chunks
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-ink-muted max-w-xs truncate">
                        {doc.metadata?.storage_path || doc.source_url || 'Supabase pgvector'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.doc_id, doc.title)}
                          disabled={deletingId === doc.doc_id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-status-danger/30 px-3 py-1.5 text-xs font-medium text-status-danger hover:bg-status-danger-bg transition-colors disabled:opacity-50"
                          title="Delete from Supabase Storage and pgvector"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === doc.doc_id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: RAG QUERY TESTER / VERIFIER */}
      <section aria-labelledby="tester-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="tester-heading" className="eyebrow flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-coral" />
            <span>RAG Semantic Search & Citation Tester</span>
          </h2>
          <p className="text-sm text-ink-soft">
            Verify the accuracy of your uploaded documents. Run a test question through the exact semantic retrieval pipeline that passengers use.
          </p>
        </div>

        <div className="surface p-6 sm:p-8 space-y-6">
          <form onSubmit={handleTestAsk} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. What is the compensation for flight cancellations under SriLankan Airlines policy?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              className="h-12 flex-1 rounded-xl border border-ink/15 bg-sand-50 px-4 text-sm text-ink focus:border-ink focus:outline-none"
            />
            <Button type="submit" variant="primary" disabled={testLoading || !testQuery.trim()}>
              {testLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Querying pgvector...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Test Retrieval
                </>
              )}
            </Button>
          </form>

          {testResult && (
            <div className="space-y-6 border-t border-ink/10 pt-6">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Answer Generated by SkyGuardian RAG</span>
                <span className="font-mono text-xs text-ink-muted">Latency: {testResult.latency_ms}ms</span>
              </div>

              <div className="rounded-2xl bg-sand-100 p-5 space-y-3">
                <p className="text-base text-ink leading-relaxed whitespace-pre-wrap">{testResult.answer}</p>
              </div>

              {testResult.chunks && testResult.chunks.length > 0 && (
                <div className="space-y-3">
                  <p className="eyebrow">Top Cited Chunks from Supabase pgvector</p>
                  <div className="space-y-3">
                    {testResult.chunks.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-ink/10 bg-sand-50 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink">
                            Excerpt {idx + 1}: {item.chunk?.metadata?.title || 'Knowledge Chunk'}
                          </span>
                          <span className="rounded-full bg-coral/10 px-2 py-0.5 font-mono text-coral-deep font-medium">
                            Match: {(item.score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-ink-soft font-mono leading-relaxed line-clamp-3">
                          {item.chunk?.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
