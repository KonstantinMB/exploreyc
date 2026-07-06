import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders a markdown string (e.g. Perplexity research output) with explicit,
 * self-contained Tailwind styling — no @tailwindcss/typography plugin required.
 */
export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`space-y-2.5 text-sm text-foreground/90 leading-relaxed break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 className="text-base font-bold text-foreground mt-3 mb-1" {...p} />,
          h2: (p) => <h4 className="text-sm font-bold text-foreground mt-3 mb-1" {...p} />,
          h3: (p) => <h5 className="text-sm font-semibold text-foreground mt-3 mb-1" {...p} />,
          h4: (p) => (
            <h6 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1" {...p} />
          ),
          p: (p) => <p className="leading-relaxed" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 space-y-1 marker:text-[#FB651E]/60" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 space-y-1 marker:text-muted-foreground" {...p} />,
          li: (p) => <li className="leading-relaxed pl-0.5" {...p} />,
          a: ({ href, ...p }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline break-words"
              {...p}
            />
          ),
          code: (p) => <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs" {...p} />,
          blockquote: (p) => (
            <blockquote className="border-l-2 border-blue-400/50 pl-3 italic text-muted-foreground" {...p} />
          ),
          hr: () => <hr className="border-border/50 my-3" />,
          table: (p) => (
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse my-2" {...p} />
            </div>
          ),
          th: (p) => <th className="border border-border px-2 py-1 text-left font-semibold bg-muted/50" {...p} />,
          td: (p) => <td className="border border-border px-2 py-1 align-top" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
