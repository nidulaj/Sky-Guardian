import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { FileSearch, Gauge, MessageSquareText, Route } from 'lucide-react';
import SectionHeading from './SectionHeading';

interface Agent {
  name: string;
  question: string;
  does: string;
  Icon: LucideIcon;
}

const AGENTS: Agent[] = [
  {
    name: 'Journey risk agent',
    question: 'How risky is this journey, and is recovery needed?',
    does: 'Uses the flight, connection and weather tools, scores the journey 0–100 and decides if the next agents should run.',
    Icon: Gauge,
  },
  {
    name: 'Policy agent',
    question: 'What do the airline rules say about my situation?',
    does: 'Searches airline policy documents and trusted travel sites, and checks the quality of each source.',
    Icon: FileSearch,
  },
  {
    name: 'Alternative agent',
    question: 'Which other routes could still get me there?',
    does: 'Finds, filters and ranks backup routes by arrival time, transfer safety and policy fit.',
    Icon: Route,
  },
];

const RECOVERY: Agent = {
  name: 'Recovery agent',
  question: 'So what should I do now?',
  does: 'Uses all the results to write one clear recommendation, based only on what the other agents found.',
  Icon: MessageSquareText,
};

function AgentCard({ agent, index }: { agent: Agent; index: number }) {
  const { Icon } = agent;
  return (
    <li className="flex flex-col rounded-3xl border border-ink/10 bg-sand-100 p-6 transition-colors hover:border-ink/25">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ink-muted">Agent {index}</span>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-coral-soft text-coral-deep">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <h3 className="display mt-6 text-3xl text-ink">{agent.name}</h3>
      <p className="mt-3 text-base leading-relaxed text-ink-soft">{agent.question}</p>
      <div className="mt-auto pt-6">
        <div className="border-t border-ink/10 pt-4">
          <p className="eyebrow">What it does</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{agent.does}</p>
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
          title="Four agents,"
          accent="one honest answer."
          description="A supervisor decides which agent runs next. Each agent has one job and uses simple tools to get its data."
        />

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent, i) => (
            <AgentCard key={agent.name} agent={agent} index={i + 1} />
          ))}

          <li className="flex flex-col justify-between gap-8 rounded-3xl bg-gradient-to-br from-cabin-light via-cabin to-cabin-dark p-6 text-white">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white/85">Agent 4 · final step</span>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-coral-peach">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div>
              <h3 className="display text-3xl">
                Recovery <span className="accent text-coral-peach">agent</span>
              </h3>
              <p className="mt-3 text-base leading-relaxed text-white/85">{RECOVERY.question}</p>
            </div>
            <div className="border-t border-white/15 pt-4">
              <p className="font-mono text-xs uppercase tracking-label text-white/85">What it does</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white">{RECOVERY.does}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
