import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Markdown 渲染组件属性接口
 */
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 预处理 Markdown 内容
 * 确保正确的 Markdown 语法格式
 * @param content - 原始内容
 * @returns 处理后的内容
 */
const preprocessMarkdown = (content: string): string => {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let processed = content;

  processed = processed.replace(/^(#{1,6})\s+/gm, '$1 ');

  processed = processed.replace(/\*\*([^*]+)\*\*/g, '**$1**');
  processed = processed.replace(/\*([^*]+)\*/g, '*$1*');
  processed = processed.replace(/__([^_]+)__/g, '__$1__');
  processed = processed.replace(/_([^_]+)_/g, '_$1_');

  processed = processed.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const trimmedCode = code.trim();
    return `\`\`\`${lang}\n${trimmedCode}\n\`\`\``;
  });

  processed = processed.replace(/`([^`]+)`/g, '`$1`');

  processed = processed.replace(/^(\s*)[-*+]\s+/gm, '$1- ');

  processed = processed.replace(/^\s*\d+\.\s+/gm, '1. ');

  processed = processed.replace(/\n{3,}/g, '\n\n');

  return processed;
};

/**
 * Markdown 渲染组件
 * 用于渲染 AI 响应中的 Markdown 内容
 * 支持 GFM 语法、LaTeX 数学公式（通过 remark-math + rehype-katex 渲染为 KaTeX）
 * 公式颜色通过全局 .katex { color: inherit } 规则继承父元素，确保深色主题下可见
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content, className = '' }) => {
  const processedContent = useMemo(() => preprocessMarkdown(content), [content]);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mb-3 mt-4 first:mt-0 border-b border-dark-500 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold text-white mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-bold text-white mb-1 mt-2 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1 ml-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">
              {children}
            </li>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            
            if (isInline) {
              return (
                <code 
                  className="bg-dark-600 text-primary-300 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            const language = codeClassName?.replace('language-', '') || '';
            
            return (
              <div className="relative my-2">
                {language && (
                  <span className="absolute top-0 right-0 text-xs text-dark-400 bg-dark-600 px-2 py-0.5 rounded-bl">
                    {language}
                  </span>
                )}
                <pre className="bg-dark-800 rounded-lg p-3 overflow-x-auto border border-dark-600">
                  <code className="text-sm font-mono text-dark-100" {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-500 pl-3 my-2 italic text-dark-300 bg-dark-700/50 py-2 rounded-r">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-dark-200">
              {children}
            </em>
          ),
          hr: () => (
            <hr className="border-dark-500 my-3" />
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border border-dark-600 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-dark-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-dark-600">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-dark-700/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-sm font-semibold text-white border-b border-dark-600">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm border-b border-dark-600/50">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-400 hover:text-primary-300 underline transition-colors"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full h-auto rounded-lg my-2"
              loading="lazy"
            />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export default MarkdownRenderer;
