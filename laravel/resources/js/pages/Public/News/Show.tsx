import { Head } from '@inertiajs/react'
import type { ReactNode } from 'react'

type BodyMark = {
    type?: string
    attrs?: {
        href?: string
    }
}

type BodyNode = {
    type?: string
    text?: string
    attrs?: {
        alt?: string
        href?: string
        level?: number
        src?: string
    }
    content?: BodyNode[]
    marks?: BodyMark[]
}

type NewsArticle = {
    slug: string
    title: string
    description: string
    image: string
    imageAlt: string
    date: string
    kind: string
    sourceUrl: string | null
    body: string | null
    bodyJson: BodyNode | null
    sourceLabel: string
}

type NewsShowProps = {
    meta: {
        title: string
        description: string
    }
    article: NewsArticle
    emptyState: string
}

export default function Show({ meta, article, emptyState }: NewsShowProps) {
    return (
        <>
            <Head title={meta.title}>
                <meta name="description" content={meta.description} />
            </Head>

            <main className="min-h-screen bg-background text-foreground">
                <section className="relative isolate overflow-hidden bg-dgb-900 px-5 py-20 text-white sm:px-8 md:px-20 md:py-28">
                    <img src={article.image} alt="" className="absolute inset-0 -z-20 size-full object-cover opacity-30" />
                    <div className="absolute inset-0 -z-10 bg-linear-to-br from-dgb-900/95 via-dgb-800/80 to-fb-500/35" />
                    <div className="relative mx-auto max-w-4xl">
                        <a href="/" className="font-montserrat text-sm font-semibold text-fb-200 transition-colors hover:text-white">
                            Kembali ke beranda
                        </a>
                        <p className="mt-10 font-montserrat text-sm font-bold uppercase tracking-[0.18em] text-fb-300">{article.date}</p>
                        <h1 className="mt-4 font-montserrat text-4xl font-semibold leading-tight md:text-6xl">{article.title}</h1>
                        <p className="mt-6 max-w-3xl font-inter text-base leading-7 text-white/85">{article.description}</p>
                    </div>
                </section>

                <article className="mx-auto grid max-w-4xl gap-8 px-5 py-14 sm:px-8 md:py-20">
                    <img src={article.image} alt={article.imageAlt} width="1200" height="750" className="aspect-[16/10] w-full rounded-xl object-cover shadow-lg shadow-dgb-900/10" />

                    {article.bodyJson ? <NewsBody document={article.bodyJson} /> : null}
                    {!article.bodyJson && article.body ? (
                        <p className="whitespace-pre-line font-inter text-base leading-8 text-[#505050]">{article.body}</p>
                    ) : null}
                    {!article.bodyJson && !article.body ? (
                        <div className="rounded-xl border border-dashed border-dgb-200 bg-dgb-50/60 p-8 text-center">
                            <p className="font-montserrat text-sm text-dgb-700">{emptyState}</p>
                        </div>
                    ) : null}

                    {article.sourceUrl ? (
                        <div className="border-t border-dgb-100 pt-6">
                            <a
                                href={article.sourceUrl}
                                target={isExternal(article.sourceUrl) ? '_blank' : '_self'}
                                rel={isExternal(article.sourceUrl) ? 'noreferrer' : undefined}
                                className="inline-flex min-h-10 items-center rounded-md bg-dgb px-5 py-2.5 font-montserrat text-sm font-semibold text-white transition-colors hover:bg-dgb-600"
                            >
                                {article.sourceLabel}
                            </a>
                        </div>
                    ) : null}
                </article>
            </main>
        </>
    )
}

function NewsBody({ document }: { document: BodyNode }) {
    const nodes = document.type === 'doc' ? document.content ?? [] : [document]

    return <div className="grid gap-5 font-inter text-base leading-8 text-[#505050]">{nodes.map((node, index) => renderBlock(node, `body-${index}`))}</div>
}

function renderBlock(node: BodyNode, key: string): ReactNode {
    const content = node.content ?? []

    switch (node.type) {
        case 'heading':
            return node.attrs?.level === 3 ? (
                <h3 key={key} className="font-montserrat text-2xl font-semibold leading-tight text-dgb-900">
                    {content.map((child, index) => renderInline(child, `${key}-${index}`))}
                </h3>
            ) : (
                <h2 key={key} className="font-montserrat text-3xl font-semibold leading-tight text-dgb-900">
                    {content.map((child, index) => renderInline(child, `${key}-${index}`))}
                </h2>
            )
        case 'bulletList':
            return (
                <ul key={key} className="grid gap-2 pl-6 marker:text-fb-500">
                    {content.map((child, index) => <li key={`${key}-${index}`}>{renderListItem(child, `${key}-${index}`)}</li>)}
                </ul>
            )
        case 'orderedList':
            return (
                <ol key={key} className="grid gap-2 pl-6 marker:text-fb-500">
                    {content.map((child, index) => <li key={`${key}-${index}`}>{renderListItem(child, `${key}-${index}`)}</li>)}
                </ol>
            )
        case 'blockquote':
            return (
                <blockquote key={key} className="border-l-4 border-fb-400 pl-5 italic text-dgb-700">
                    {content.map((child, index) => renderBlock(child, `${key}-${index}`))}
                </blockquote>
            )
        case 'image':
            return renderImage(node, key)
        case 'horizontalRule':
            return <hr key={key} className="border-dgb-100" />
        case 'paragraph':
            return <p key={key}>{content.map((child, index) => renderInline(child, `${key}-${index}`))}</p>
        case 'hardBreak':
            return <br key={key} />
        default:
            return content.length > 0 ? <div key={key}>{content.map((child, index) => renderBlock(child, `${key}-${index}`))}</div> : null
    }
}

function renderListItem(node: BodyNode, key: string): ReactNode {
    if (node.type !== 'listItem') {
        return renderInline(node, key)
    }

    return node.content?.map((child, index) => child.type === 'paragraph'
        ? child.content?.map((inline, inlineIndex) => renderInline(inline, `${key}-${index}-${inlineIndex}`))
        : renderBlock(child, `${key}-${index}`))
}

function renderInline(node: BodyNode, key: string): ReactNode {
    if (node.type !== 'text') {
        return renderBlock(node, key)
    }

    let value: ReactNode = node.text ?? ''

    for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') {
            value = <strong key={`${key}-bold`}>{value}</strong>
        } else if (mark.type === 'italic') {
            value = <em key={`${key}-italic`}>{value}</em>
        } else if (mark.type === 'link' && mark.attrs?.href && isSafeHref(mark.attrs.href)) {
            value = (
                <a
                    key={`${key}-link`}
                    href={mark.attrs.href}
                    target={isExternal(mark.attrs.href) ? '_blank' : '_self'}
                    rel={isExternal(mark.attrs.href) ? 'noreferrer' : undefined}
                    className="font-semibold text-dgb underline decoration-fb-400 underline-offset-4"
                >
                    {value}
                </a>
            )
        }
    }

    return <span key={key}>{value}</span>
}

function renderImage(node: BodyNode, key: string): ReactNode {
    const src = node.attrs?.src

    if (!src || !isSafeHref(src)) {
        return null
    }

    return <img key={key} src={src} alt={node.attrs?.alt ?? ''} width="1200" height="800" className="w-full rounded-lg object-cover" />
}

function isExternal(href: string): boolean {
    return href.startsWith('http://') || href.startsWith('https://')
}

function isSafeHref(href: string): boolean {
    return (href.startsWith('/') && !href.startsWith('//')) || /^https:\/\//i.test(href)
}
