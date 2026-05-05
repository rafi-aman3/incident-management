/**
 * Tiny shim so `node --env-file=<file>` can run any command with the file's
 * env vars loaded. Used by package.json's db:push / db:types so the Supabase
 * CLI picks up SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD from .env.local
 * (the CLI doesn't read dotenv files natively).
 *
 * Usage:
 *   node --env-file=.env.local scripts/with-env-file.mjs <cmd> [args...]
 *
 * The child inherits stdio, so output redirection (`>`) on the parent
 * `pnpm` script line still routes the child's stdout to the target file.
 */

import { spawn } from "node:child_process";

const [, , cmd, ...rest] = process.argv;

if (!cmd) {
  console.error("usage: node --env-file=<file> scripts/with-env-file.mjs <cmd> [args...]");
  process.exit(2);
}

const child = spawn(cmd, rest, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
