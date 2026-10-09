'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
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
  Sparkles,
  ArrowRight,
  Plane,
  X,
  ChevronDown,
  Check,
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

// Sample Airlines with tailored vector symbols and branding
interface SampleAirline {
  code: string;
  name: string;
  country: string;
  symbol: React.ReactNode;
}

const SAMPLE_AIRLINES: SampleAirline[] = [
  {
    code: 'UL',
    name: 'SriLankan Airlines',
    country: 'Sri Lanka',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <path d="M20 4C14 10 11 18 13 26C15 34 25 34 27 26C29 18 26 10 20 4Z" fill="#00843D" />
        <ellipse cx="20" cy="20" rx="4.5" ry="6.5" fill="#00A859" />
        <circle cx="20" cy="20" r="2.5" fill="#FDB913" />
        <circle cx="20" cy="20" r="1" fill="#002D62" />
        <path d="M12 28C8 20 12 12 16 7" stroke="#FDB913" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 28C32 20 28 12 24 7" stroke="#FDB913" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    code: 'MH',
    name: 'Malaysia Airlines',
    country: 'Malaysia',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <path d="M6 14C14 10 26 10 34 14C28 22 22 28 20 36C18 28 12 22 6 14Z" fill="#002B7F" />
        <path d="M10 15C16 12 24 12 30 15C25 21 21 26 20 32C19 26 15 21 10 15Z" fill="#ED1C24" />
        <circle cx="20" cy="18" r="3" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    code: 'SQ',
    name: 'Singapore Airlines',
    country: 'Singapore',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <path d="M6 12L20 22L34 12L28 18L20 28L12 18L6 12Z" fill="#D4AF37" />
        <path d="M14 6L20 18L26 6L23 12L20 8L17 12L14 6Z" fill="#B38F28" />
        <path d="M20 24L20 36L18 30L20 24Z" fill="#D4AF37" />
      </svg>
    ),
  },
  {
    code: 'EK',
    name: 'Emirates',
    country: 'UAE',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#D71921" />
        <path d="M12 20C16 14 24 14 28 20C24 26 16 26 12 20Z" stroke="#FFFFFF" strokeWidth="2.5" fill="none" />
        <path d="M15 17C18 13 22 13 25 17" stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    code: 'QR',
    name: 'Qatar Airways',
    country: 'Qatar',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#5C0632" />
        <path d="M15 32L17 22L12 10L14 10L19 20L21 20L26 10L28 10L23 22L25 32H15Z" fill="#FFFFFF" />
        <path d="M18 18L20 13L22 18H18Z" fill="#C0C0C0" />
      </svg>
    ),
  },
  {
    code: 'QF',
    name: 'Qantas Airways',
    country: 'Australia',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#E0001B" />
        <path d="M10 26C14 24 19 18 22 13C24 10 26 10 28 12C26 15 23 18 21 21C24 20 27 18 30 19C28 22 24 25 18 28C14 30 11 28 10 26Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    code: 'CX',
    name: 'Cathay Pacific',
    country: 'Hong Kong',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#006564" />
        <path d="M8 22C14 20 24 14 32 10C26 18 18 24 12 26C10 26 8 24 8 22Z" fill="#FFFFFF" />
        <path d="M14 21C20 17 26 14 32 10C24 16 18 20 14 21Z" fill="#B2D8D8" />
      </svg>
    ),
  },
  {
    code: 'NH',
    name: 'All Nippon Airways (ANA)',
    country: 'Japan',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#00205B" />
        <path d="M8 26L22 10H32L18 26H8Z" fill="#009fe3" />
        <path d="M14 26L25 13H32L21 26H14Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    code: 'JL',
    name: 'Japan Airlines (JAL)',
    country: 'Japan',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <circle cx="20" cy="20" r="16" fill="#FFFFFF" stroke="#D91C24" strokeWidth="2" />
        <path d="M20 7C14 12 11 20 12 28C16 32 24 32 28 28C29 20 26 12 20 7Z" fill="#D91C24" />
        <path d="M10 18C14 20 18 20 22 18" stroke="#FFFFFF" strokeWidth="1.5" />
        <circle cx="20" cy="12" r="2.5" fill="#D91C24" stroke="#FFFFFF" strokeWidth="1" />
      </svg>
    ),
  },
];

// Predefined searchable airline options
const PREDEFINED_AIRLINES = [
  { code: 'UL', label: 'SriLankan Airlines', detail: 'Sri Lanka' },
  { code: 'MH', label: 'Malaysia Airlines', detail: 'Malaysia' },
  { code: 'SQ', label: 'Singapore Airlines', detail: 'Singapore' },
  { code: 'EK', label: 'Emirates', detail: 'United Arab Emirates' },
  { code: 'QR', label: 'Qatar Airways', detail: 'Qatar' },
  { code: 'QF', label: 'Qantas Airways', detail: 'Australia' },
  { code: 'CX', label: 'Cathay Pacific', detail: 'Hong Kong' },
  { code: 'NH', label: 'All Nippon Airways (ANA)', detail: 'Japan' },
  { code: 'JL', label: 'Japan Airlines (JAL)', detail: 'Japan' },
  { code: 'BA', label: 'British Airways', detail: 'United Kingdom' },
  { code: 'LH', label: 'Lufthansa', detail: 'Germany' },
  { code: 'AF', label: 'Air France', detail: 'France' },
  { code: 'KL', label: 'KLM Royal Dutch Airlines', detail: 'Netherlands' },
  { code: 'TK', label: 'Turkish Airlines', detail: 'Turkey' },
  { code: 'EY', label: 'Etihad Airways', detail: 'United Arab Emirates' },
  { code: 'TG', label: 'Thai Airways', detail: 'Thailand' },
  { code: 'AI', label: 'Air India', detail: 'India' },
  { code: '6E', label: 'IndiGo', detail: 'India' },
  { code: 'AA', label: 'American Airlines', detail: 'United States' },
  { code: 'DL', label: 'Delta Air Lines', detail: 'United States' },
  { code: 'UA', label: 'United Airlines', detail: 'United States' },
];

// Predefined searchable airport options
const PREDEFINED_AIRPORTS = [
  { code: 'CMB', label: 'Bandaranaike International Airport', detail: 'Colombo, Sri Lanka' },
  { code: 'KUL', label: 'Kuala Lumpur International Airport', detail: 'Kuala Lumpur, Malaysia' },
  { code: 'SIN', label: 'Singapore Changi Airport', detail: 'Singapore' },
  { code: 'NRT', label: 'Narita International Airport', detail: 'Tokyo, Japan' },
  { code: 'HND', label: 'Tokyo Haneda Airport', detail: 'Tokyo, Japan' },
  { code: 'LHR', label: 'London Heathrow Airport', detail: 'London, United Kingdom' },
  { code: 'DXB', label: 'Dubai International Airport', detail: 'Dubai, UAE' },
  { code: 'DOH', label: 'Hamad International Airport', detail: 'Doha, Qatar' },
  { code: 'SYD', label: 'Sydney Kingsford Smith Airport', detail: 'Sydney, Australia' },
  { code: 'MEL', label: 'Melbourne Airport', detail: 'Melbourne, Australia' },
  { code: 'BKK', label: 'Suvarnabhumi Airport', detail: 'Bangkok, Thailand' },
  { code: 'HKG', label: 'Hong Kong International Airport', detail: 'Hong Kong' },
  { code: 'DEL', label: 'Indira Gandhi International Airport', detail: 'Delhi, India' },
  { code: 'BOM', label: 'Chhatrapati Shivaji Maharaj Airport', detail: 'Mumbai, India' },
  { code: 'JFK', label: 'John F. Kennedy International Airport', detail: 'New York, USA' },
  { code: 'CDG', label: 'Charles de Gaulle Airport', detail: 'Paris, France' },
  { code: 'FRA', label: 'Frankfurt Airport', detail: 'Frankfurt, Germany' },
  { code: 'AMS', label: 'Amsterdam Airport Schiphol', detail: 'Amsterdam, Netherlands' },
  { code: 'ICN', label: 'Incheon International Airport', detail: 'Seoul, South Korea' },
  { code: 'AUH', label: 'Zayed International Airport', detail: 'Abu Dhabi, UAE' },
];

/**
 * Reusable searchable combobox dropdown.
 * Supports quick filtering, keyboard selection, and optional clearing.
 */
function SearchableSelect({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select option...',
  options,
  helperText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, label?: string) => void;
  placeholder?: string;
  options: Array<{ code: string; label: string; detail?: string }>;
  helperText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = options.find((o) => o.code === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const filtered = options.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.code.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q) ||
      (item.detail && item.detail.toLowerCase().includes(q))
    );
  });

  return (
    <div ref={wrapperRef} className="space-y-2 relative">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="eyebrow block">
          {label}
        </label>
        <span className="text-[10px] font-mono text-ink-muted uppercase">Optional</span>
      </div>

      <div className="relative">
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={`h-12 w-full rounded-xl border bg-sand-50 px-4 text-left text-sm transition-colors flex items-center justify-between ${
            open ? 'border-ink ring-1 ring-ink' : 'border-ink/15 hover:border-ink/30'
          }`}
        >
          {selectedItem ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-coral-deep bg-coral-peach/20 px-1.5 py-0.5 rounded text-xs">
                {selectedItem.code}
              </span>
              <span className="text-ink truncate">{selectedItem.label}</span>
            </span>
          ) : (
            <span className="text-ink-muted text-sm">{placeholder}</span>
          )}

          <div className="flex items-center gap-1 text-ink-soft shrink-0 ml-2">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="hover:text-status-danger p-1 rounded-md"
                title="Clear selection"
              >
                <X className="h-4 w-4" />
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-2xl border border-ink/15 bg-sand-50 shadow-2xl p-2 space-y-2 max-h-72 overflow-hidden flex flex-col">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type to filter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-ink/15 bg-sand-100/60 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none"
              />
            </div>

            <div className="overflow-y-auto divide-y divide-ink/5 flex-1 pr-1">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                  !value ? 'bg-sand-200 font-semibold text-ink' : 'text-ink-muted hover:bg-sand-100'
                }`}
              >
                <span>(None / Leave blank)</span>
                {!value && <Check className="h-3.5 w-3.5 text-coral" />}
              </button>

              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-muted">No matches found</div>
              ) : (
                filtered.map((item) => {
                  const isSelected = item.code === value;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        onChange(item.code, item.label);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                        isSelected ? 'bg-coral-peach/20 font-medium text-ink' : 'hover:bg-sand-100 text-ink'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-xs bg-sand-200 px-1.5 py-0.5 rounded text-ink">
                          {item.code}
                        </span>
                        <div className="truncate">
                          <span className="block truncate text-sm">{item.label}</span>
                          {item.detail && <span className="block text-[11px] text-ink-muted truncate">{item.detail}</span>}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-coral shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {helperText && <p className="text-xs text-ink-muted">{helperText}</p>}
    </div>
  );
}

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

  // Handle airline selection from the quick sample box
  const handleSelectSampleAirline = (airline: SampleAirline) => {
    if (airlineCode === airline.code) {
      // Toggle off / clear if already selected
      setAirlineCode('');
      setAirlineName('');
    } else {
      setAirlineCode(airline.code);
      setAirlineName(airline.name);
    }
  };

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
    // Sensible backend default for carrier carriage rules
    formData.append('policy_type', 'CARRIER_CONDITIONS_OF_CARRIAGE');

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
      doc.airport?.toLowerCase().includes(q) ||
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
            <p className="display text-3xl text-ink font-semibold">{stats?.store_backend || 'pgvector'}</p>
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
            Upload PDF or text documents. Text is automatically chunked, embedded via 768-dim vectorizer, and linked with Supabase Storage.
          </p>
        </div>

        <form onSubmit={handleUpload} className="surface p-6 sm:p-8 space-y-8">
          {/* Quick Select Sample Airlines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="eyebrow block">
                Quick Select Airline (Click to auto-populate)
              </label>
              <span className="text-xs text-ink-muted">Click to select or toggle off</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
              {SAMPLE_AIRLINES.map((airline) => {
                const isSelected = airlineCode === airline.code;
                return (
                  <button
                    key={airline.code}
                    type="button"
                    onClick={() => handleSelectSampleAirline(airline)}
                    className={`relative p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
                      isSelected
                        ? 'border-coral bg-coral-peach/15 ring-2 ring-coral shadow-sm'
                        : 'border-ink/15 bg-sand-50/70 hover:border-coral/50 hover:bg-sand-50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-coral text-white text-[10px]">
                        ✓
                      </span>
                    )}

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-100 shadow-inner">
                      {airline.symbol}
                    </div>

                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-xs block text-ink">
                        {airline.code}
                      </span>
                      <span className="text-[11px] font-medium text-ink-soft leading-tight line-clamp-1 block">
                        {airline.name.split(' ')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-ink/10">
            {/* Left Column: File upload & Title */}
            <div className="space-y-5">
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

            {/* Right Column: Airline Name & Searchable Dropdowns (Code & Airport) */}
            <div className="space-y-5">
              <Input
                id="airline-name"
                label="Airline Name"
                placeholder="e.g. SriLankan Airlines or Singapore Airlines"
                value={airlineName}
                onChange={(e) => setAirlineName(e.target.value)}
                helperText="Pre-filled when you click a sample box above, or enter any carrier."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Searchable Airline Code Dropdown (Optional) */}
                <SearchableSelect
                  id="airline-code-select"
                  label="Airline Code"
                  placeholder="Select IATA code..."
                  value={airlineCode}
                  onChange={(code, label) => {
                    setAirlineCode(code);
                    if (label && !airlineName) {
                      setAirlineName(label);
                    }
                  }}
                  options={PREDEFINED_AIRLINES}
                  helperText="Searchable. Not required."
                />

                {/* Searchable Airport Code Dropdown (Optional) */}
                <SearchableSelect
                  id="airport-code-select"
                  label="Airport Code"
                  placeholder="Select airport..."
                  value={airportCode}
                  onChange={(code) => setAirportCode(code)}
                  options={PREDEFINED_AIRPORTS}
                  helperText="Searchable. Not required."
                />
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
                    <th className="eyebrow px-6 py-4 font-normal">Document & Carrier</th>
                    <th className="eyebrow px-6 py-4 font-normal">Airport / Hub</th>
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
                            <span>· ID: {doc.doc_id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {doc.airport ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 px-3 py-1 text-xs font-mono font-medium text-ink-soft">
                            <Plane className="h-3 w-3" />
                            {doc.airport}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted font-mono">Global / Multi-hub</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-ink">
                        {doc.total_chunks ?? '1+'} chunks
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-ink-muted max-w-xs truncate">
                        {doc.storage_path || doc.source_url || 'Supabase pgvector'}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Answer Generated by SkyGuardian</span>
                  {testResult.source_type === 'web_search' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-amber-800 border border-amber-500/20">
                      🌐 Live Web Search Fallback
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-emerald-800 border border-emerald-500/20">
                      🛡️ Supabase pgvector RAG
                    </span>
                  )}
                </div>
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
