"use client";

import { useActionState, useState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState | null = null;

export function LoginForm({
  next,
  demoAccounts,
}: {
  next: string;
  demoAccounts: { label: string; email: string }[];
}) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Demo!2026");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {demoAccounts.length > 0 ? (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Demo accounts (password <code className="font-mono">Demo!2026</code>)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-accent"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
