"use client";

import { Upload } from "lucide-react";

import { importTeachers, type ImportState } from "./actions";
import { useFormAction } from "@/hooks/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ImportState = {};

export function ImportForm() {
  const [state, formProps, pending] = useFormAction(
    importTeachers,
    initialState,
  );

  return (
    <form {...formProps} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="file"
          name="file"
          accept=".xlsx,.csv"
          required
          className="sm:max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          <Upload className="size-4" />
          {pending ? "Mengimpor…" : "Impor"}
        </Button>
      </div>

      {state.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}

      {state.ok ? (
        <div className="bg-muted/40 rounded-md px-3 py-2 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">
            {state.created} guru berhasil dibuat
            {state.failed ? `, ${state.failed} gagal` : ""}.
          </p>
          {state.errors && state.errors.length > 0 ? (
            <ul className="text-muted-foreground mt-1 list-disc pl-5 text-xs">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
