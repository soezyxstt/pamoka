import { Head, Link } from '@inertiajs/react'
import type { ReactElement } from 'react'
import AdminLayout from '../../layouts/AdminLayout'

type AuditLog = {
    id: string
    createdAt: string | null
    actorLabel: string
    action: string
    resourceType: string
    resourceId: string | null
    resourceLabel: string | null
    source: string
    reason: string | null
}

type Props = {
    logs: AuditLog[]
}

export default function AdminAudit({ logs }: Props) {
    return <>
        <Head title="Audit log" />
        <section>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-fb-500">Operasional / audit</p><h1 className="mt-2 font-montserrat text-3xl font-semibold text-dgb-900">Audit log</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Jejak perubahan admin untuk membantu peninjauan keputusan dan akuntabilitas.</p></div><Link href="/admin" className="inline-flex min-h-10 items-center justify-center rounded-md border border-dgb px-4 py-2 text-sm font-semibold text-dgb transition-colors hover:bg-dgb hover:text-white">Kembali ke dashboard</Link></div>
            <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-white"><table className="min-w-[760px] w-full text-left"><thead className="border-b border-border bg-muted/65"><tr><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Waktu</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Aktor</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Aksi</th><th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Resource</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(log.createdAt)}</td><td className="px-4 py-3 text-sm font-medium text-dgb-900">{log.actorLabel}</td><td className="px-4 py-3"><span className="rounded-md bg-dgb-50 px-2.5 py-1 text-xs font-medium text-dgb">{log.action}</span></td><td className="px-4 py-3 text-sm text-muted-foreground">{log.resourceType} · {log.resourceLabel ?? log.resourceId ?? 'Tanpa ID'}</td></tr>)}</tbody></table>{logs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Belum ada aktivitas.</p>}</div>
        </section>
    </>
}

AdminAudit.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>

function formatDate(value: string | null): string {
    if (value === null) return 'Tidak tersedia'

    return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}
