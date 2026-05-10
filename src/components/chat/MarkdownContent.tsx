'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="mb-3 last:mb-0 space-y-1 ml-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 last:mb-0 space-y-1 ml-1 list-decimal list-inside">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-zinc-900 dark:text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-zinc-500 dark:text-zinc-300">{children}</em>,
        code: ({ children, className }) => {
          const isInline = !className
          if (isInline) {
            return <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[13px] font-mono break-all">{children}</code>
          }
          return (
            <code className="block overflow-x-auto rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-3 text-[13px] font-mono text-zinc-700 dark:text-zinc-300 mb-3 last:mb-0 whitespace-pre-wrap break-words">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 mb-3 last:mb-0 text-zinc-500 dark:text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-zinc-200 dark:border-zinc-700 my-4" />,
        img: ({ src, alt }) => (
          <a href={src as string} target="_blank" rel="noopener noreferrer" className="block my-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src as string} alt={alt || ''} className="max-w-full max-h-[300px] rounded-lg border border-zinc-200 dark:border-zinc-700" loading="lazy" />
          </a>
        ),
        a: ({ href, children }) => {
          const isFile = href && /\.(pdf|doc|docx|xls|xlsx|csv|txt|md|json)(\?|$)/i.test(href)
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={cn('underline underline-offset-2', isFile ? 'inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white no-underline px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-[13px]' : 'text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300')}>
              {isFile && <FileText className="w-3.5 h-3.5 shrink-0" />}
              {children}
            </a>
          )
        },
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3 last:mb-0">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-left text-zinc-700 dark:text-zinc-300 font-medium bg-zinc-50 dark:bg-zinc-800/50">{children}</th>,
        td: ({ children }) => <td className="border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
})

export default MarkdownContent
