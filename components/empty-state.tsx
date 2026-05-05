import { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center px-6">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h2 className="text-xl font-semibold">{title}</h2>
      {body ? (
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
