import { describe, it, expect } from 'vitest';

/**
 * 预处理 Markdown 内容函数
 * 与 MarkdownRenderer.tsx 中保持一致
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

describe('Markdown Preprocessing', () => {
  describe('Basic Text', () => {
    it('should handle empty content', () => {
      expect(preprocessMarkdown('')).toBe('');
      expect(preprocessMarkdown(null as unknown as string)).toBe('');
      expect(preprocessMarkdown(undefined as unknown as string)).toBe('');
    });

    it('should preserve plain text', () => {
      const content = 'This is plain text without any formatting.';
      expect(preprocessMarkdown(content)).toBe(content);
    });

    it('should handle multi-paragraph content', () => {
      const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      expect(preprocessMarkdown(content)).toBe(content);
    });
  });

  describe('Headings', () => {
    it('should preserve heading syntax', () => {
      expect(preprocessMarkdown('# Heading 1')).toBe('# Heading 1');
      expect(preprocessMarkdown('## Heading 2')).toBe('## Heading 2');
      expect(preprocessMarkdown('### Heading 3')).toBe('### Heading 3');
      expect(preprocessMarkdown('#### Heading 4')).toBe('#### Heading 4');
      expect(preprocessMarkdown('##### Heading 5')).toBe('##### Heading 5');
      expect(preprocessMarkdown('###### Heading 6')).toBe('###### Heading 6');
    });

    it('should handle headings with extra spaces', () => {
      expect(preprocessMarkdown('#   Heading with spaces')).toBe('# Heading with spaces');
    });
  });

  describe('Emphasis', () => {
    it('should preserve bold text', () => {
      expect(preprocessMarkdown('**bold text**')).toBe('**bold text**');
      expect(preprocessMarkdown('__bold text__')).toBe('__bold text__');
    });

    it('should preserve italic text', () => {
      expect(preprocessMarkdown('*italic text*')).toBe('*italic text*');
      expect(preprocessMarkdown('_italic text_')).toBe('_italic text_');
    });

    it('should handle combined emphasis', () => {
      expect(preprocessMarkdown('**bold and *italic* text**')).toBe('**bold and *italic* text**');
    });
  });

  describe('Code Blocks', () => {
    it('should preserve inline code', () => {
      expect(preprocessMarkdown('This has `inline code` in it.')).toBe('This has `inline code` in it.');
    });

    it('should preserve code blocks with language', () => {
      const content = '```javascript\nconst x = 1;\n```';
      expect(preprocessMarkdown(content)).toBe('```javascript\nconst x = 1;\n```');
    });

    it('should preserve code blocks without language', () => {
      const content = '```\nplain code\n```';
      expect(preprocessMarkdown(content)).toBe('```\nplain code\n```');
    });

    it('should trim code block content', () => {
      const content = '```javascript\n\nconst x = 1;\n\n```';
      expect(preprocessMarkdown(content)).toBe('```javascript\nconst x = 1;\n```');
    });

    it('should handle multi-line code blocks', () => {
      const content = '```python\ndef hello():\n    print("Hello")\n    return True\n```';
      expect(preprocessMarkdown(content)).toBe(content);
    });
  });

  describe('Lists', () => {
    it('should normalize unordered list markers', () => {
      expect(preprocessMarkdown('- item')).toBe('- item');
      expect(preprocessMarkdown('* item')).toBe('- item');
      expect(preprocessMarkdown('+ item')).toBe('- item');
    });

    it('should normalize ordered list markers', () => {
      expect(preprocessMarkdown('1. item')).toBe('1. item');
      expect(preprocessMarkdown('2. item')).toBe('1. item');
      expect(preprocessMarkdown('10. item')).toBe('1. item');
    });

    it('should handle nested lists', () => {
      const content = '- item 1\n  - nested item';
      expect(preprocessMarkdown(content)).toBe('- item 1\n  - nested item');
    });
  });

  describe('Blockquotes', () => {
    it('should preserve blockquotes', () => {
      const content = '> This is a quote';
      expect(preprocessMarkdown(content)).toBe(content);
    });

    it('should handle multi-line blockquotes', () => {
      const content = '> Line 1\n> Line 2';
      expect(preprocessMarkdown(content)).toBe(content);
    });
  });

  describe('Tables', () => {
    it('should preserve table syntax', () => {
      const content = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
      expect(preprocessMarkdown(content)).toBe(content);
    });
  });

  describe('Links and Images', () => {
    it('should preserve links', () => {
      const content = '[Link text](https://example.com)';
      expect(preprocessMarkdown(content)).toBe(content);
    });

    it('should preserve images', () => {
      const content = '![Alt text](https://example.com/image.png)';
      expect(preprocessMarkdown(content)).toBe(content);
    });
  });

  describe('Complex Content', () => {
    it('should handle mixed content', () => {
      const content = `# Main Heading

This is a paragraph with **bold** and *italic* text.

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

### List Items

- First item
- Second item
  - Nested item

> A blockquote

[Visit Example](https://example.com)`;

      const result = preprocessMarkdown(content);
      expect(result).toContain('# Main Heading');
      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('```javascript');
      expect(result).toContain('- First item');
      expect(result).toContain('> A blockquote');
    });

    it('should handle AI response with explanation', () => {
      const content = `Here's an explanation of the concept:

**Key Points:**
1. First point
2. Second point

\`inline code\` example.`;

      const result = preprocessMarkdown(content);
      expect(result).toContain('**Key Points:**');
      expect(result).toContain('1. First point');
      expect(result).toContain('`inline code`');
    });

    it('should handle code-heavy response', () => {
      const content = `Here's the solution:

\`\`\`typescript
interface User {
  id: string;
  name: string;
}

function getUser(id: string): User {
  return { id, name: 'Test' };
}
\`\`\`

Use the \`getUser\` function to fetch user data.`;

      const result = preprocessMarkdown(content);
      expect(result).toContain('```typescript');
      expect(result).toContain('interface User');
      expect(result).toContain('`getUser`');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple consecutive newlines', () => {
      const content = 'Paragraph 1\n\n\n\n\nParagraph 2';
      expect(preprocessMarkdown(content)).toBe('Paragraph 1\n\nParagraph 2');
    });

    it('should handle special characters', () => {
      const content = 'Special chars: < > & " \' @ # $ % ^';
      expect(preprocessMarkdown(content)).toBe(content);
    });

    it('should handle Unicode characters', () => {
      const content = '中文测试 🎉 Émoji';
      expect(preprocessMarkdown(content)).toBe(content);
    });
  });
});
