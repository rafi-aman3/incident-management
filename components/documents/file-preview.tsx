"use client";

/**
 * Renders a fetched-on-demand signed-URL preview for a document.
 *
 *   * image/* → inline <img>
 *   * application/pdf → <iframe>
 *   * everything else → "Download file" button
 */

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getSignedDocumentUrl } from "@/lib/documents/upload";

export function FilePreview({
  storagePath,
  mimeType,
  fileName,
}: {
  storagePath: string;
  mimeType: string;
  fileName: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setError(null);
    getSignedDocumentUrl(storagePath, 60 * 5)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load");
      });
    return () => {
      active = false;
    };
  }, [storagePath]);

  if (error) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/30 py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…
      </div>
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-md border bg-muted/30">
        <Image
          src={url}
          alt={fileName}
          width={1200}
          height={800}
          unoptimized
          className="h-auto w-full"
        />
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-md border bg-muted/30">
        <iframe
          src={url}
          title={fileName}
          className="h-[60vh] w-full"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-6">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{fileName}</p>
          <p className="text-[11px] text-muted-foreground">{mimeType}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open
          </a>
        </Button>
        <Button asChild size="sm">
          <a href={url} download={fileName}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
          </a>
        </Button>
      </div>
    </div>
  );
}
