import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PassengerPolicyAssistant from '@/components/dashboard/PassengerPolicyAssistant';
import { askRagQuestion } from '@/lib/api/client';
import type { AskQuestionResponse } from '@/types/rag';

vi.mock('@/lib/api/client', () => ({ askRagQuestion: vi.fn() }));

const reply: AskQuestionResponse = {
  question: 'What happens if my flight is cancelled?',
  answer: 'Ask your airline about a refund or replacement flight.',
  sources: [
    { name: 'Airline cancellation rules', source_url: 'https://www.britishairways.com/policies', relevance_score: 0.95 },
    { name: 'Stored policy document' },
    { name: 'Unsafe source', source_url: 'javascript:alert(1)' },
    { name: 'Invalid source', source_url: 'http-invalid:example' },
  ],
  chunks: [],
  source_type: 'web_search',
  latency_ms: 300,
  execution_steps: [{ step: 1, name: 'Gemini LLM Policy Synthesis', status: 'FAILED', detail: 'Unavailable' }],
};

function submitQuestion() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Airline question' }), {
    target: { value: reply.question },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask a question' }));
}

describe('Passenger airline help', () => {
  beforeEach(() => {
    vi.mocked(askRagQuestion).mockReset();
  });

  it('keeps live policy search and safe source links without technical labels', async () => {
    vi.mocked(askRagQuestion).mockResolvedValue(reply);
    render(<PassengerPolicyAssistant />);
    submitQuestion();

    expect(await screen.findByText(reply.answer)).toBeInTheDocument();
    expect(askRagQuestion).toHaveBeenCalledWith(reply.question, 3, 0.15, undefined, { enable_web_fallback: true });
    const link = screen.getByRole('link', { name: 'Airline cancellation rules' });
    expect(link).toHaveAttribute('href', reply.sources[0].source_url);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('Stored policy document')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Supabase|RAG|pipeline|Gemini|Verified|95%/i);
  });

  it('uses a short loading state without simulated completed checks', () => {
    vi.mocked(askRagQuestion).mockReturnValue(new Promise(() => {}));
    render(<PassengerPolicyAssistant />);
    submitQuestion();

    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();
    expect(document.body.textContent).not.toMatch(/pipeline|pgvector|Gemini|Verified/i);
    fireEvent.submit(screen.getByRole('textbox', { name: 'Airline question' }).closest('form')!);
    expect(askRagQuestion).toHaveBeenCalledTimes(1);
  });

  it('shows a plain retry message when the search fails', async () => {
    vi.mocked(askRagQuestion).mockRejectedValue(new Error());
    render(<PassengerPolicyAssistant />);
    submitQuestion();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not check the airline rules. Please try again.');
    expect(screen.getByRole('button', { name: 'Ask a question' })).toBeEnabled();
  });
});
