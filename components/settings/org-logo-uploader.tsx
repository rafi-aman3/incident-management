"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  uploadOrgLogo,
  removeOrgLogo,
} from "@/app/(app)/settings/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function OrgLogoUploader({
  logoUrl,
  publicUrl,
}: {
  logoUrl: string | null;
  publicUrl: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(uploadOrgLogo, null);
  const [isRemoving, startRemoveTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      toast.success("Logo updated");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl(null);
      formRef.current?.reset();
    }
    if (state && state.ok === false) toast.error(state.error);
  }, [state]);

  // Local-preview the file before upload so the user can sanity-check
  // before committing the network round-trip.
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(f));
  }

  const showLogo = previewUrl ?? publicUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted/40">
          {showLogo ? (
            // Storage URLs aren't a configured Next image host; using a
            // plain <img> avoids the next.config dance for a small avatar.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={showLogo}
              alt="Organisation logo"
              className="h-full w-full object-contain"
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onFileChange}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-accent"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !previewUrl}
              className="shrink-0"
            >
              {isPending ? "Uploading…" : "Save logo"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Square recommended. 200×200 minimum, up to 2 MB. JPEG, PNG, WebP,
            or GIF.
          </p>
          {logoUrl && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                  Remove logo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove organisation logo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current logo will be deleted. You can upload a new one
                    at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    disabled={isRemoving}
                    onClick={() =>
                      startRemoveTransition(async () => {
                        const res = await removeOrgLogo();
                        if (res.ok) toast.success("Logo removed");
                        else toast.error(res.error);
                      })
                    }
                  >
                    {isRemoving ? "Removing…" : "Remove"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
