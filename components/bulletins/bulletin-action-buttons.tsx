"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, EyeOff, Archive } from "lucide-react";
import {
  publishBulletin,
  unpublishBulletin,
  archiveBulletin,
} from "@/app/(app)/bulletins/actions";

function ActionButton({
  id,
  label,
  icon,
  action,
  destructive,
  confirmText,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  destructive?: boolean;
  confirmText?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  function handleClick() {
    if (confirmText && !confirmed) {
      setConfirmed(true);
      return;
    }
    startTransition(async () => {
      const res = await action(id);
      if (res.ok) {
        toast.success(`${label} done`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setConfirmed(false);
    });
  }

  const showConfirm = confirmText && confirmed;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 " +
        (destructive
          ? "border-destructive/30 text-destructive hover:bg-destructive/10"
          : "bg-background hover:bg-accent")
      }
    >
      {icon}
      {showConfirm ? `${confirmText}?` : label}
    </button>
  );
}

export function PublishButton({ id }: { id: string }) {
  return (
    <ActionButton
      id={id}
      label="Publish"
      icon={<Send className="h-3.5 w-3.5" />}
      action={publishBulletin}
    />
  );
}

export function UnpublishButton({ id }: { id: string }) {
  return (
    <ActionButton
      id={id}
      label="Unpublish"
      icon={<EyeOff className="h-3.5 w-3.5" />}
      action={unpublishBulletin}
      confirmText="Unpublish"
    />
  );
}

export function ArchiveButton({ id }: { id: string }) {
  return (
    <ActionButton
      id={id}
      label="Archive"
      icon={<Archive className="h-3.5 w-3.5" />}
      action={archiveBulletin}
      destructive
      confirmText="Archive"
    />
  );
}
