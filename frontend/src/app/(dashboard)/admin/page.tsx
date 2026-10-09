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
  Scale,
  BookOpen,
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
    code: 'BA',
    name: 'British Airways',
    country: 'United Kingdom',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#075AAA" />
        <path d="M8 24C14 22 24 16 32 12C26 20 18 26 12 28C10 28 8 26 8 24Z" fill="#EB2226" />
        <path d="M12 22C18 19 26 15 32 12C24 18 17 22 12 22Z" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    code: 'DL',
    name: 'Delta Air Lines',
    country: 'United States',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <rect x="4" y="4" width="32" height="32" rx="8" fill="#003366" />
        <path d="M20 9L29 27H24L20 18L16 27H11L20 9Z" fill="#E01933" />
        <path d="M20 18L24 27H16L20 18Z" fill="#8B0000" />
      </svg>
    ),
  },
  {
    code: 'LH',
    name: 'Lufthansa',
    country: 'Germany',
    symbol: (
      <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none">
        <circle cx="20" cy="20" r="16" fill="#05164D" />
        <circle cx="20" cy="20" r="14.5" stroke="#FFB600" strokeWidth="1.5" />
        <path d="M11 25C15 23 20 18 29 13C24 16 19 21 15 25H11Z" fill="#FFB600" />
        <path d="M17 19C20 16 24 14 28 13C23 18 19 21 16 23L17 19Z" fill="#FFB600" />
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
  // Premium floating notification popup state
  const [notice, setNotice] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    fileName?: string;
    badge?: string;
    actionText?: string;
    onAction?: () => void;
  } | null>(null);
  const [noticeProgress, setNoticeProgress] = useState(100);
  const [isNoticePaused, setIsNoticePaused] = useState(false);

  // Auto-dismiss countdown timer for notice popup (7 seconds)
  useEffect(() => {
    if (!notice) {
      setNoticeProgress(100);
      return;
    }

    setNoticeProgress(100);
    const totalDuration = 7000;
    const intervalTime = 50;
    const step = (intervalTime / totalDuration) * 100;

    const interval = setInterval(() => {
      if (!isNoticePaused) {
        setNoticeProgress((prev) => {
          if (prev <= 0) {
            clearInterval(interval);
            setNotice(null);
            return 0;
          }
          return Math.max(0, prev - step);
        });
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [notice, isNoticePaused]);

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

  // Delete confirmation modal state
  const [docToDelete, setDocToDelete] = useState<RAGDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Close delete confirmation modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && docToDelete && !deletingId) {
        setDocToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docToDelete, deletingId]);

  // Fetch initial data
  const refreshData = async () => {
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
      setNotice({
        id: Date.now().toString(),
        type: 'error',
        title: 'Policy Vault Connection Issue',
        message: 'Could not load documents from policy repository. Ensure backend is running.',
      });
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
      if (!docTitle.trim() || docTitle.includes('Conditions of Carriage') || docTitle.includes('Contract of Carriage')) {
        setDocTitle(`${airline.name} General Conditions of Carriage`);
      }
    }
  };

  // Handle document upload
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setNotice({
        id: Date.now().toString(),
        type: 'error',
        title: 'No Document Selected',
        message: 'Please choose a PDF, TXT, or MD policy document to upload.',
      });
      return;
    }

    setUploading(true);

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
      const clausesCount = result.chunks_created || 0;
      setNotice({
        id: Date.now().toString(),
        type: 'success',
        title: 'Policy Document Indexed',
        message: 'Document analyzed, vectorized, and active in the policy knowledge base.',
        fileName: selectedFile.name,
        badge: `${clausesCount} Policy Clauses Extracted`,
        actionText: 'View in Vault',
        onAction: () => {
          document.getElementById('library-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      });

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
      setNotice({
        id: Date.now().toString(),
        type: 'error',
        title: 'Ingestion Failed',
        message: err.message || 'Failed to upload and index document into the policy vault.',
      });
    } finally {
      setUploading(false);
    }
  };

  // Open premium delete confirmation modal
  const handleRequestDelete = (doc: RAGDocument) => {
    if (deletingId) return;
    setDocToDelete(doc);
  };

  // Execute document removal from vault
  const confirmDeleteDoc = async () => {
    if (!docToDelete || deletingId) return;

    const target = docToDelete;
    setDeletingId(target.doc_id);

    try {
      await deleteRAGDocument(target.doc_id, token || undefined);

      // Optimistic instant UI update
      setDocuments((prev) => prev.filter((d) => d.doc_id !== target.doc_id));
      setStats((prev) =>
        prev
          ? {
              ...prev,
              documents: Math.max(0, prev.documents - 1),
              chunks: Math.max(0, prev.chunks - (target.total_chunks || 1)),
            }
          : null
      );

      // Dismiss modal immediately
      setDocToDelete(null);

      // Show luxury toast notification
      setNotice({
        id: Date.now().toString(),
        type: 'info',
        title: 'Policy Removed',
        message: `"${target.title || target.doc_id}" has been removed from the active policy vault.`,
        badge: 'Vault Synchronized',
      });

      // Background sync to ensure exact server consistency
      await refreshData();
    } catch (err: any) {
      setNotice({
        id: Date.now().toString(),
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Failed to delete document from the policy vault.',
      });
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

  const uniqueCarriersCount = new Set(
    documents.map((d) => d.airline_code || d.airline).filter(Boolean)
  ).size;

  return (
    <div className="space-y-12 sm:space-y-16">
      <PageHeader
        eyebrow="Admin Operations / Airline Policy Vault"
        title="Policy documents &"
        accent="regulatory rules."
        description="Manage airline conditions of carriage, regulatory passenger rights (EU261, UK261, DOT), and hub transit agreements powering automated disruption recovery."
        actions={
          <Button variant="outline" onClick={refreshData} disabled={loadingStats || loadingDocs}>
            <RefreshCw className={`h-4 w-4 ${loadingStats || loadingDocs ? 'animate-spin' : ''}`} />
            Refresh Policy Vault
          </Button>
        }
      />

      {/* PREMIUM DELETION CONFIRMATION MODAL */}
      {docToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-sand-950/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingId) {
              setDocToDelete(null);
            }
          }}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-ink/15 bg-sand-50/98 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(26,23,20,0.5),0_0_0_1px_rgba(255,255,255,0.8)_inset] animate-in zoom-in-95 duration-200">
            {/* Ambient Radial Aura Glow */}
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-status-danger/15 blur-3xl pointer-events-none" />

            {/* Header Close Button */}
            <button
              type="button"
              onClick={() => !deletingId && setDocToDelete(null)}
              disabled={!!deletingId}
              className="absolute top-5 right-5 h-8 w-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-sand-200 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Dismiss dialog"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Body */}
            <div className="space-y-6">
              {/* Alert Badge & Header */}
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-status-danger-bg border border-status-danger/30 text-status-danger shadow-inner">
                    <Trash2 className="h-6 w-6 stroke-[2.2]" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-danger opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-status-danger" />
                  </span>
                </div>

                <div className="space-y-1 pr-6">
                  <span className="font-mono text-[10px] tracking-widest uppercase font-bold text-status-danger">
                    Security Clearance / Irreversible Action
                  </span>
                  <h3 id="delete-dialog-title" className="font-sans font-semibold text-xl text-ink leading-tight">
                    Remove Document from Vault
                  </h3>
                </div>
              </div>

              {/* Document Summary Card */}
              <div className="rounded-2xl border border-ink/10 bg-sand-100/90 p-4 space-y-2.5">
                <div className="space-y-1">
                  <p className="font-semibold text-ink text-sm sm:text-base leading-snug">
                    {docToDelete.title || docToDelete.doc_id}
                  </p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    Document ID: {docToDelete.doc_id}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {docToDelete.airline && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 px-2.5 py-0.5 text-xs font-medium text-coral">
                      {docToDelete.airline}
                      {docToDelete.airline_code && ` (${docToDelete.airline_code})`}
                    </span>
                  )}
                  {docToDelete.airport ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 px-2.5 py-0.5 text-xs font-mono text-ink-soft">
                      <Plane className="h-3 w-3" />
                      {docToDelete.airport}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sand-200 px-2.5 py-0.5 text-xs font-mono text-ink-muted">
                      Global Carrier
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-danger-bg border border-status-danger/20 px-2.5 py-0.5 text-xs font-mono font-medium text-status-danger">
                    <Layers className="h-3 w-3" />
                    {docToDelete.total_chunks ?? '1+'} vector rules
                  </span>
                </div>
              </div>

              {/* Explanatory text */}
              <p className="text-xs text-ink-muted leading-relaxed">
                Are you sure you want to permanently remove this carriage policy? This will remove the source document, erase indexed vector chunks from pgvector, and cease real-time automated disruption assessments referencing this document.
              </p>

              {/* In-Flight Removal Progress Stripe */}
              {deletingId && (
                <div className="space-y-2 rounded-xl bg-status-danger-bg/50 border border-status-danger/20 p-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-status-danger">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Removing vector embeddings and storage files...</span>
                  </div>
                  <div className="h-1.5 w-full bg-status-danger/20 rounded-full overflow-hidden">
                    <div className="h-full bg-status-danger rounded-full animate-pulse w-full" />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDocToDelete(null)}
                  disabled={!!deletingId}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={confirmDeleteDoc}
                  disabled={!!deletingId}
                  className="bg-red-600 hover:bg-red-700 text-white border-transparent shadow-md shadow-red-600/25 disabled:opacity-50"
                >
                  {deletingId ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Removing Document...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove Document</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LUXURY FLOATING NOTIFICATION POPUP */}
      {notice && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-6 right-6 z-50 w-full max-w-[440px] px-4 sm:px-0 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300 ease-out"
        >
          <div
            onMouseEnter={() => setIsNoticePaused(true)}
            onMouseLeave={() => setIsNoticePaused(false)}
            className="pointer-events-auto relative overflow-hidden rounded-3xl border border-ink/15 bg-sand-50/95 backdrop-blur-2xl p-5 shadow-[0_25px_60px_-15px_rgba(26,23,20,0.35),0_0_0_1px_rgba(255,255,255,0.8)_inset] transition-all duration-300"
          >
            {/* Ambient Radial Aura Glow */}
            <div
              className={`absolute -top-12 -left-12 h-36 w-36 rounded-full blur-2xl pointer-events-none ${
                notice.type === 'success'
                  ? 'bg-emerald-500/20'
                  : notice.type === 'error'
                  ? 'bg-status-danger/25'
                  : 'bg-sand-400/25'
              }`}
            />

            <div className="relative flex items-start gap-4">
              {/* Status Icon Badge with Dual Ring & Pulse */}
              <div className="relative shrink-0">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-inner ${
                    notice.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700'
                      : notice.type === 'error'
                      ? 'bg-status-danger-bg border border-status-danger/30 text-status-danger'
                      : 'bg-sand-200 border border-ink/15 text-ink'
                  }`}
                >
                  {notice.type === 'success' ? (
                    <CheckCircle2 className="h-6 w-6 stroke-[2.2]" />
                  ) : notice.type === 'error' ? (
                    <AlertCircle className="h-6 w-6 stroke-[2.2]" />
                  ) : (
                    <Layers className="h-6 w-6 stroke-[2.2]" />
                  )}
                </div>
                {notice.type === 'success' && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Eyebrow & Close Button */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[10px] tracking-widest uppercase font-bold ${
                      notice.type === 'success'
                        ? 'text-emerald-700'
                        : notice.type === 'error'
                        ? 'text-status-danger'
                        : 'text-ink-muted'
                    }`}
                  >
                    {notice.type === 'success'
                      ? '01 / Vault Synchronized'
                      : notice.type === 'error'
                      ? 'System Warning'
                      : 'Policy Vault Update'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotice(null)}
                    className="h-6 w-6 -mr-1 -mt-1 flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-sand-200/80 transition-colors"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Title */}
                <h4 className="font-sans font-bold text-ink text-sm sm:text-base leading-snug">
                  {notice.title}
                </h4>

                {/* Monospace File Pill */}
                {notice.fileName && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sand-100/90 border border-ink/10 text-xs text-ink font-mono shadow-sm">
                    <FileText className="h-3.5 w-3.5 text-coral shrink-0" />
                    <span className="truncate font-semibold">{notice.fileName}</span>
                  </div>
                )}

                {/* Subtitle / Message */}
                <p className="text-xs text-ink-soft leading-relaxed">
                  {notice.message}
                </p>

                {/* Footer: Badge and Quick Action */}
                {(notice.badge || notice.actionText) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-ink/5">
                    {notice.badge && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-mono font-medium text-emerald-800">
                        <Sparkles className="h-3 w-3 text-emerald-600" />
                        {notice.badge}
                      </span>
                    )}
                    {notice.actionText && notice.onAction && (
                      <button
                        type="button"
                        onClick={notice.onAction}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink hover:text-coral transition-colors ml-auto"
                      >
                        {notice.actionText}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Animated Progress Timer Line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-ink/5 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ease-linear ${
                  notice.type === 'success'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : notice.type === 'error'
                    ? 'bg-status-danger'
                    : 'bg-ink'
                }`}
                style={{ width: `${noticeProgress}%` }}
              />
            </div>
          </div>
        </aside>
      )}

      {/* SECTION 1: POLICY INTELLIGENCE & COVERAGE OVERVIEW */}
      <section aria-labelledby="stats-heading" className="space-y-4">
        <h2 id="stats-heading" className="eyebrow flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-coral" />
          <span>01 / Policy Intelligence & Coverage Overview</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Policy Documents</p>
            <p className="display text-3xl text-ink font-semibold">{documents.length}</p>
            <p className="text-xs text-ink-soft">Verified conditions of carriage & regulatory acts</p>
          </div>

          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Indexed Policy Rules</p>
            <p className="display text-3xl text-coral font-semibold">{stats?.total_chunks ?? '...'}</p>
            <p className="text-xs text-ink-soft">Searchable disruption, delay & care clauses</p>
          </div>

          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Covered Airlines & Hubs</p>
            <p className="display text-3xl text-ink font-semibold">{uniqueCarriersCount > 0 ? `${uniqueCarriersCount} Airlines` : 'Global Hubs'}</p>
            <p className="text-xs text-ink-soft">International & domestic carriage rules</p>
          </div>

          <div className="surface p-6 space-y-2">
            <p className="eyebrow text-ink-muted">Policy Engine Status</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="flex h-3 w-3 rounded-full bg-status-safe animate-pulse" />
              <span className="text-base font-medium text-ink">Active & Verified</span>
            </div>
            <p className="text-xs text-ink-soft">Automated passenger recovery protection</p>
          </div>
        </div>
      </section>

      {/* SECTION 2: DOCUMENT INGESTION FORM */}
      <section aria-labelledby="upload-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="upload-heading" className="eyebrow flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-coral" />
            <span>02 / Ingest Airline & Regulatory Policies</span>
          </h2>
          <p className="text-sm text-ink-soft">
            Upload PDF or text documents. Content is automatically parsed into searchable legal clauses and indexed for instant disruption evaluation.
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

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2.5">
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
                      Parsing & Indexing Policy Document...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      Ingest into Policy Knowledge Base
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
              <BookOpen className="h-4 w-4 text-coral" />
              <span>03 / Policy Document Vault</span>
            </h2>
            <p className="text-sm text-ink-soft">
              {filteredDocs.length} {filteredDocs.length === 1 ? 'policy document' : 'policy documents'} actively protecting passenger journeys.
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
            <p className="text-sm text-ink-soft">Loading indexed policy documents...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="surface p-12 text-center space-y-3">
            <FileText className="h-8 w-8 text-ink-muted mx-auto" />
            <p className="text-base font-semibold text-ink">No documents match your search</p>
            <p className="text-sm text-ink-soft">Upload a policy document using the form above to add it to the policy knowledge repository.</p>
          </div>
        ) : (
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 bg-sand-100/50">
                    <th className="eyebrow px-6 py-4 font-normal">Document & Carrier</th>
                    <th className="eyebrow px-6 py-4 font-normal">Airport / Hub</th>
                    <th className="eyebrow px-6 py-4 font-normal">Indexed Rules</th>
                    <th className="eyebrow px-6 py-4 font-normal">Jurisdiction / Source</th>
                    <th className="eyebrow px-6 py-4 font-normal text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {filteredDocs.map((doc) => {
                    const isRowDeleting = deletingId === doc.doc_id;
                    return (
                      <tr
                        key={doc.doc_id}
                        className={`hover:bg-sand-50/50 transition-colors ${
                          isRowDeleting ? 'opacity-40 bg-status-danger-bg/20' : ''
                        }`}
                      >
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
                          {doc.total_chunks ?? '1+'} rules
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-ink-muted max-w-xs truncate">
                          {doc.jurisdiction || doc.source_url || 'Verified Carriage Rules'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(doc)}
                            disabled={!!deletingId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-status-danger/30 px-3 py-1.5 text-xs font-medium text-status-danger hover:bg-status-danger-bg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            title="Remove from policy vault"
                          >
                            {isRowDeleting ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Removing...</span>
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: POLICY ASSISTANT QUERY TESTER */}
      <section aria-labelledby="tester-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="tester-heading" className="eyebrow flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-coral" />
            <span>04 / Policy Assistant Query & Citation Tester</span>
          </h2>
          <p className="text-sm text-ink-soft">
            Verify the accuracy of your airline policies. Test inquiries against the exact policy intelligence engine used by passenger assistants.
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
                  Consulting Policy Engine...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Test Policy Query
                </>
              )}
            </Button>
          </form>

          {testResult && (
            <div className="space-y-6 border-t border-ink/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Answer Generated by SkyGuardian Policy Engine</span>
                  {testResult.source_type === 'web_search' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-amber-800 border border-amber-500/20">
                      🌐 Live Web Intelligence Fallback
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-emerald-800 border border-emerald-500/20">
                      🛡️ Verified Policy Vault
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
                  <p className="eyebrow">Top Cited Policy Clauses & Precedents</p>
                  <div className="space-y-3">
                    {testResult.chunks.map((item, idx) => (
                      <div key={idx} className="rounded-xl border border-ink/10 bg-sand-50 p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink">
                            Clause {idx + 1}: {item.chunk?.metadata?.title || 'Conditions of Carriage'}
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
