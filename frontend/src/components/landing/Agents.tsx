import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { CloudSun, FileSearch, Gauge, MessageSquareText, Plane, Route, Timer } from 'lucide-react';
import SectionHeading from './SectionHeading';

interface Agent {
  name: string;
  question: string;
  source: string;
  Icon: LucideIcon;
}

const AGENTS: Agent[] = [
  {
    name: 'Flight agent',
    question: 'Is each flight on time, delayed or cancelled?',
    source: 'Flight status API',
    Icon: Plane,
  },
  {
    name: 'Connection agent',
    question: 'Do I still have enough time to make my transfer?',
    source: 'Python maths: next departure minus arrival, against minimum connection time',
    Icon: Timer,
  },
  {
    name: 'Weather agent',
    question: 'Could the weather slow things down at my airports?',
    source: 'Weather API for departure and transfer airports',
    Icon: CloudSun,
  },
  {
    name: 'Risk agent',
    question: 'How exposed is this journey overall?',
    source: 'Deterministic weighted formula, same input gives same score',
    Icon: Gauge,
  },
  {
    name: 'Policy agent',
    question: 'What do the airline rules say about my situation?',
    source: 'Airline policy documents and trusted travel sites',
    Icon: FileSearch,
  },
  {
    name: 'Alternative agent',
    question: 'Which other routes could still get me there?',
    source: 'Ranking by arrival time, transfer safety and policy fit',
    Icon: Route,
  },
];

const RECOVERY: Agent = {
  name: 'Recovery agent',
  question: 'So what should I do now?',
  source: 'LLM summary, grounded in the other agents’ results',
  Icon: MessageSquareText,
};

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const { Icon } = agent;
  return (
    <li className="flex flex-col rounded-3xl border border-ink/10 bg-sand-100 p-6 transition-colors hover:border-ink/25">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ink-muted">A{index}</span>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-coral-soft text-coral-deep">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <h3 className="display mt-6 text-3xl text-ink">{agent.name}</h3>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">{agent.question}</p>
      <div className="mt-auto pt-6">
        <div className="border-t border-ink/10 pt-4">
          <p className="eyebrow">Data source</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{agent.source}</p>
        </div>
      </div>
    </li>
  );
}

export default function Agents() {
  const { Icon } = RECOVERY;
  return (
    <section id="agents" aria-labelledby="agents-title" className="scroll-mt-4">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          id="agents-title"
          eyebrow="The agents"
          title="Seven specialists,"
          accent="one honest answer."
          description="No free-roaming chatbot. Each agent answers one question with a known data source, and the supervisor decides when it runs."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent, i) => (
            <AgentCard key={agent.name} agent={agent} index={i + 1} />
          ))}

          <li className="flex flex-col justify-between gap-8 rounded-3xl bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark p-6 text-white sm:col-span-2 sm:p-8">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white/85">A7 · final step</span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-coral-peach">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div>
              <h3 className="display text-4xl sm:text-5xl">
                {RECOVERY.name.split(' ')[0]} <span className="accent text-coral-peach">agent</span>
              </h3>
              <p className="mt-3 max-w-md text-lg leading-relaxed text-white/85">{RECOVERY.question}</p>
            </div>
            <div className="border-t border-white/15 pt-4">
              <p className="font-mono text-xs uppercase tracking-label text-white/85">Data source</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white">{RECOVERY.source}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
