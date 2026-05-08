"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PenLine, Trash2 } from "lucide-react";

/**
 * Lightweight signature canvas. Captures a name + drawn signature; on
 * "Save" it converts the canvas to a PNG Blob and hands it off to the
 * caller via onSave.
 */
export function SignatureCanvas({
  initialName,
  onSave,
  onClear,
  saved,
}: {
  initialName?: string;
  onSave: (payload: { name: string; blob: Blob }) => Promise<void> | void;
  onClear: () => void;
  saved: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nameInputId = useId();
  const [name, setName] = useState(initialName ?? "");
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pending, setPending] = useState(false);

  // Set up a high-DPI canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#222";
  }, []);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = getPoint(e);
    setIsDirty(true);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e);
    ctx.beginPath();
    if (lastPoint.current) {
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    } else {
      ctx.moveTo(p.x, p.y);
    }
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  }
  function up() {
    drawing.current = false;
    lastPoint.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsDirty(false);
    onClear();
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!name.trim()) return;
    if (!isDirty) return;
    setPending(true);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas empty"))), "image/png");
      });
      await onSave({ name: name.trim(), blob });
    } finally {
      setPending(false);
    }
  }

  if (saved) {
    return (
      <div className="rounded-md border-2 border-success/40 bg-success/5 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium text-success">Signed by {name || "—"}</span>
          <button
            type="button"
            onClick={() => {
              onClear();
              clearCanvas();
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={nameInputId} className="block text-xs font-medium text-muted-foreground">
        Printed name
      </label>
      <input
        id={nameInputId}
        type="text"
        placeholder="Type your full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        maxLength={120}
      />
      <div className="rounded-md border-2 border-dashed bg-background p-1">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="block h-32 w-full touch-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label="Signature drawing area"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          aria-label="Clear signature"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || !name.trim() || pending}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          <PenLine className="h-4 w-4 sm:h-3 sm:w-3" />{" "}
          {pending ? "Saving..." : "Save signature"}
        </button>
      </div>
    </div>
  );
}
