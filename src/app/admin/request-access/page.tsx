import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Clock3, Send } from "lucide-react";

import { AdminAuthShell } from "@/components/admin/admin-shell";
import { AdminButton } from "@/components/admin/primitives";
import { AdminField, AdminTextarea } from "@/components/admin/primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { auth } from "@/server/auth/config";
import { ensurePendingAdminProfile } from "@/server/auth/authorization";
import { requestAccessAction } from "./actions";

export default async function RequestAccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/admin/login");
  await ensurePendingAdminProfile(session.user.id);

  return (
    <AdminAuthShell
      eyebrow="Permintaan akses"
      title="Buka ruang kerja Anda."
      description="Akun Google Anda sudah tercatat. Ceritakan area yang perlu Anda kelola agar Role Administrator dapat menetapkan akses yang tepat."
    >
      <form action={requestAccessAction} className="space-y-6">
        <AdminField label="Alasan kebutuhan akses" hint="Minimal 10 karakter, maksimal 500 karakter.">
          <AdminTextarea name="reason" required minLength={10} maxLength={500} placeholder="Contoh: Saya perlu mengelola berita dan galeri kegiatan." />
        </AdminField>
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-foreground">Area yang diperlukan</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["content", "Konten"],
              ["voting", "Voting"],
              ["users", "Pengguna"],
            ].map(([value, label]) => (
              <label
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-3 text-sm text-foreground transition-colors has-[[data-state=checked]]:border-fb-300 has-[[data-state=checked]]:bg-fb-50"
                htmlFor={`area-${value}`}
                key={value}
              >
                <Checkbox
                  id={`area-${value}`}
                  name="areas"
                  value={value}
                  className="border-fb-300 data-[state=checked]:border-fb data-[state=checked]:bg-fb data-[state=checked]:text-white"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <AdminButton type="submit" className="w-full">
          <Send size={16} /> Kirim permintaan akses
        </AdminButton>
        <div className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Clock3 size={15} className="mt-0.5 shrink-0 text-fb-500" />
          Permintaan akan ditinjau oleh Role Administrator dan seluruh keputusan tercatat di audit log.
        </div>
      </form>
    </AdminAuthShell>
  );
}
