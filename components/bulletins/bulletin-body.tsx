import ReactMarkdown from "react-markdown";

/**
 * Lightweight markdown renderer for bulletin bodies. v1 supports the
 * default react-markdown set (headings, lists, links, emphasis, code,
 * blockquotes). No HTML, no images. Same render path on both the
 * detail page and the dashboard widget (when the latter ever shows
 * body excerpts; it currently doesn't).
 */
export function BulletinBody({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_a]:text-primary [&_a]:underline">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
