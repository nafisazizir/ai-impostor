import { memo } from "react";
import Markdown from "react-markdown";

const components = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-muted-foreground/80">{children}</strong>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold last:mb-0">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold last:mb-0">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold last:mb-0">{children}</p>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold last:mb-0">{children}</p>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold last:mb-0">{children}</p>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-1 font-semibold last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="pl-5 list-outside list-disc mb-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="pl-5 list-outside list-decimal mb-1 last:mb-0">{children}</ol>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    if (className) {
      return <code className={className}>{children}</code>;
    }
    return <code className="bg-muted/50 rounded px-0.5">{children}</code>;
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted/30 rounded p-1.5 overflow-x-auto mb-1 last:mb-0">{children}</pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-2 mb-1 last:mb-0">{children}</blockquote>
  ),
};

export const MarkdownProse = memo(function MarkdownProse({
  content,
}: {
  content: string;
}) {
  return <Markdown components={components}>{content}</Markdown>;
});
