"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, ChevronsUpDown, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

import type { AdminEditionContext } from "@/server/cms/context";
import { setAdminEditionCookie } from "@/server/cms/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AdminBadge } from "./primitives";
import { cn } from "@/lib/utils";

export type AdminEditionSelectorProps = {
  currentEdition: AdminEditionContext | null;
  editions: AdminEditionContext[];
  className?: string;
};

export function AdminEditionSelector({
  currentEdition,
  editions,
  className,
}: AdminEditionSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const handleSelectEdition = (editionId: string) => {
    if (currentEdition?.id === editionId) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      try {
        await setAdminEditionCookie(editionId);
        setOpen(false);
        router.refresh();
      } catch {
        // Error handling
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-label="Pilih edisi admin"
          disabled={isPending}
          className={cn(
            "group flex h-10 items-center gap-2 rounded-md border border-dgb-100 bg-white/80 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-dgb-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dgb-300 sm:px-3 sm:py-2",
            isPending && "opacity-60 cursor-wait",
            className,
          )}
        >
          <div className="grid size-6 shrink-0 place-items-center rounded bg-dgb-50 text-dgb">
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Calendar className="size-3.5" />
            )}
          </div>

          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-montserrat text-xs font-semibold text-dgb-900">
                {currentEdition ? currentEdition.name : "Pilih edisi"}
              </span>
              {currentEdition ? (
                <AdminBadge
                  value={currentEdition.lifecycle}
                  className="hidden py-0 text-[9px] sm:inline-flex"
                />
              ) : null}
            </div>
            {currentEdition ? (
              <p className="text-[10px] text-muted-foreground sm:hidden">
                {currentEdition.year} · {currentEdition.lifecycle === "active" ? "Aktif" : currentEdition.lifecycle === "draft" ? "Draft" : "Arsip"}
              </p>
            ) : null}
          </div>

          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 rounded-lg border border-dgb-100 bg-white p-1.5 shadow-lg"
      >
        <div className="px-2.5 py-2 border-b border-dgb-50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Konteks edisi aktif
          </p>
          <p className="mt-0.5 text-xs text-dgb-700">
            Mengatur data dashboard, konten, dan voting.
          </p>
        </div>

        <div className="my-1 max-h-60 overflow-y-auto space-y-0.5">
          {editions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Belum ada edisi yang tersedia.
            </div>
          ) : (
            editions.map((edition) => {
              const isSelected = currentEdition?.id === edition.id;
              return (
                <button
                  key={edition.id}
                  type="button"
                  onClick={() => handleSelectEdition(edition.id)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                    isSelected
                      ? "bg-dgb-50/90 text-dgb-900 font-semibold"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded text-dgb",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    >
                      <Check className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-montserrat text-xs font-semibold text-dgb-900">
                        {edition.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Tahun {edition.year}
                      </p>
                    </div>
                  </div>

                  <AdminBadge value={edition.lifecycle} className="shrink-0 py-0 text-[9px]" />
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-dgb-50 pt-1">
          <Link
            href="/admin/content/editions"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-dgb hover:bg-dgb-50"
          >
            <Sparkles className="size-3.5 text-fb-600" />
            <span>Kelola daftar edisi</span>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
