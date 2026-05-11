import DOMPurify from "isomorphic-dompurify";

/**
 * Read-only renderer for bulletin bodies. Stored as HTML (produced by
 * the TipTap editor in the composer). Sanitized with DOMPurify before
 * insertion — strips script/style/iframe/onclick-style attrs while
 * preserving the StarterKit tag set (h1-h3, p, ul/ol/li, a, em, strong,
 * blockquote, code, pre).
 */
export function BulletinBody({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "code",
      "pre",
      "hr",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
