"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWED_DOCUMENT_MIMES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";
import { uploadDocumentFile } from "@/lib/documents/upload";
import { createDocument } from "@/lib/actions/documents";

type SiteOption = { id: string; name: string };

export function DocumentUploadForm({
  orgId,
  sites,
  defaultType,
}: {
  orgId: string;
  sites: SiteOption[];
  defaultType?: DocumentType;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<DocumentType>(defaultType ?? "evidence");
  const [siteId, setSiteId] = useState<string>("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");

  function handleFile(f: File | null) {
    setFile(f);
    if (f && !name) {
      setName(f.name.replace(/\.[^.]+$/, ""));
    }
  }

  function submit() {
    if (!file) {
      toast.error("Pick a file to upload");
      return;
    }
    if (!name.trim()) {
      toast.error("Give the document a name");
      return;
    }
    startTransition(async () => {
      try {
        const meta = await uploadDocumentFile(file, orgId);
        const created = await createDocument({
          ...meta,
          name: name.trim(),
          type,
          site_id: siteId || null,
          expiry_date: expiry || null,
          notes: notes || "",
        });
        if (!created.ok) throw new Error(created.error);
        toast.success("Document uploaded");
        router.push(`/resources/documents/${created.data!.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5 rounded-lg border bg-card p-6"
    >
      <div className="rounded-md border border-dashed p-5">
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_DOCUMENT_MIMES.join(",")}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {file ? file.name : "Choose a file to upload."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              PNG · JPG · PDF · DOC/DOCX · XLS/XLSX · max 25 MB.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
          >
            {file ? "Replace" : "Choose file"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Forklift SDS — IPA solvent"
            disabled={pending}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as DocumentType)}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="site">Site scope</Label>
          <select
            id="site"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm shadow-sm"
          >
            <option value="">Org-wide</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expiry">Expiry (optional)</Label>
          <Input
            id="expiry"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why this document matters, version notes, anything the next viewer should know."
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Link
          href="/resources/documents"
          className="inline-flex items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending || !file}>
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
            </>
          ) : (
            "Upload"
          )}
        </Button>
      </div>
    </form>
  );
}
