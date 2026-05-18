"use client";

import { Loader2 } from "lucide-react";

interface ToolInvocationMessageProps {
  toolName: string;
  args: unknown;
  state: string;
  hasResult: boolean;
}

function pickString(args: unknown, key: string): string | undefined {
  if (typeof args !== "object" || args === null) return undefined;
  const value = (args as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getToolLabel(toolName: string, args: unknown, done: boolean): string {
  const path = pickString(args, "path");
  const command = pickString(args, "command");

  if (toolName === "str_replace_editor" && path) {
    switch (command) {
      case "create":
        return done ? `Created ${path}` : `Creating ${path}`;
      case "str_replace":
      case "insert":
        return done ? `Edited ${path}` : `Editing ${path}`;
      case "view":
        return done ? `Read ${path}` : `Reading ${path}`;
      case "undo_edit":
        return done ? `Reverted ${path}` : `Reverting ${path}`;
    }
  }

  if (toolName === "file_manager" && path) {
    if (command === "rename") {
      const newPath = pickString(args, "new_path");
      if (newPath) {
        return done
          ? `Renamed ${path} → ${newPath}`
          : `Renaming ${path} → ${newPath}`;
      }
    }
    if (command === "delete") {
      return done ? `Deleted ${path}` : `Deleting ${path}`;
    }
  }

  return done ? "Done" : "Working...";
}

export function ToolInvocationMessage({
  toolName,
  args,
  state: _state,
  hasResult,
}: ToolInvocationMessageProps) {
  const label = getToolLabel(toolName, args, hasResult);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {hasResult ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
