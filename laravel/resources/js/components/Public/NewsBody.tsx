import type { JSONContent } from '@tiptap/core'
import type { ReactNode } from 'react'

export function NewsBody({ document }: { document: JSONContent }) {
    const nodes = document.type === 'doc' ? document.content ?? [] : [document]

    return <div className="grid gap-5 font-inter text-base leading-8 text-[#505050]">{nodes.map((node, index) => renderBlock(node, `body-${index}`))}</div>
}

function renderBlock(node: JSONContent, key: string): ReactNode {
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

function renderListItem(node: JSONContent, key: string): ReactNode {
    if (node.type !== 'listItem') {
        return renderInline(node, key)
    }

    return node.content?.map((child, index) => child.type === 'paragraph'
        ? child.content?.map((inline, inlineIndex) => renderInline(inline, `${key}-${index}-${inlineIndex}`))
        : renderBlock(child, `${key}-${index}`))
}

function renderInline(node: JSONContent, key: string): ReactNode {
    if (node.type !== 'text') {
        return renderBlock(node, key)
    }

    let value: ReactNode = node.text ?? ''

    for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') {
            value = <strong key={`${key}-bold`}>{value}</strong>
        } else if (mark.type === 'italic') {
            value = <em key={`${key}-italic`}>{value}</em>
        } else if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && isSafeHref(mark.attrs.href)) {
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

function renderImage(node: JSONContent, key: string): ReactNode {
    const src = typeof node.attrs?.src === 'string' ? node.attrs.src : null

    if (!src || !isSafeHref(src)) {
        return null
    }

    return <img key={key} src={src} alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''} width="1200" height="800" className="w-full rounded-lg object-cover" />
}

function isExternal(href: string): boolean {
    return href.startsWith('http://') || href.startsWith('https://')
}

function isSafeHref(href: string): boolean {
    return (href.startsWith('/') && !href.startsWith('//')) || /^https:\/\//i.test(href)
}
