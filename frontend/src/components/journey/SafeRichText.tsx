import React from 'react';

/** Render **bold** spans as <strong>. Everything else stays plain text (React escapes it). */
function renderInline(line: string, keyPrefix: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== '')
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
      ),
    );
}

/**
 * Tiny safe renderer for agent-written text: blank lines start a new paragraph, single line breaks are kept,
 * and **bold** becomes <strong>. No HTML is ever interpreted.
 */
export default function SafeRichText({ text, className = '' }: { text: string; className?: string }) {
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={`space-y-4 ${className}`}>
      {paragraphs.map((para, pi) => {
        const lines = para.split('\n');
        return (
          <p key={pi}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, `${pi}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
