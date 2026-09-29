import type { ReactNode } from 'react';

/**
 * A small Markdown subset (paragraphs, headings, lists, quotes, code, tables, emphasis, links)
 * rendered straight to React elements, so message text never reaches the DOM as HTML.
 */
export function Markdown({ text }: { text: string }) {
  return <>{blocks(text.replace(/\r\n?/g, '\n').split('\n'))}</>;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const indentOf = (line: string) => line.length - line.trimStart().length;
const isBlank = (line: string) => line.trim() === '';
const startsBlock = (line: string) =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);
const cells = (row: string) =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function blocks(lines: string[]): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = out.length;
    if (isBlank(line)) {
      i++;
    } else if (FENCE.test(line)) {
      // an unclosed fence (a reply still streaming) runs to the end
      const fence = FENCE.exec(line)![1];
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence); i++) code.push(lines[i]);
      i++;
      out.push(
        <pre key={key}>
          <code>{code.join('\n')}</code>
        </pre>
      );
    } else if (HEADING.test(line)) {
      const [, hashes, title] = HEADING.exec(line)!;
      out.push(
        <p key={key} className="lk-md-h" role="heading" aria-level={hashes.length}>
          {inline(title)}
        </p>
      );
      i++;
    } else if (RULE.test(line)) {
      out.push(<hr key={key} />);
      i++;
    } else if (QUOTE.test(line)) {
      const quoted: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) quoted.push(lines[i].replace(QUOTE, ''));
      out.push(<blockquote key={key}>{blocks(quoted)}</blockquote>);
    } else if (ITEM.test(line)) {
      const first = ITEM.exec(line)!;
      const indent = first[1].length;
      const ordered = /\d/.test(first[2]);
      const items: string[][] = [];
      let body = 0; // the current item's content column, for dedenting its continuation lines
      for (; i < lines.length; i++) {
        const l = lines[i];
        const m = ITEM.exec(l);
        if (m && m[1].length === indent && /\d/.test(m[2]) === ordered) {
          items.push([m[3]]);
          body = m[0].length - m[3].length;
        } else if (isBlank(l)) {
          // a blank line ends the list unless more of it follows
          const next = lines[i + 1];
          if (next === undefined || isBlank(next) || indentOf(next) < indent) break;
          if (indentOf(next) === indent && !ITEM.test(next)) break;
          items[items.length - 1].push('');
        } else if (indentOf(l) > indent || !startsBlock(l)) {
          items[items.length - 1].push(l.slice(Math.min(indentOf(l), body)));
        } else {
          break;
        }
      }
      const lis = items.map((it, n) => <li key={n}>{blocks(it)}</li>);
      out.push(
        ordered ? (
          <ol key={key} start={parseInt(first[2], 10)}>
            {lis}
          </ol>
        ) : (
          <ul key={key}>{lis}</ul>
        )
      );
    } else if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].includes('|') && !isBlank(lines[i]); i++) rows.push(cells(lines[i]));
      out.push(
        <div key={key} className="lk-md-table">
          <table>
            <thead>
              <tr>
                {head.map((c, n) => (
                  <th key={n}>{inline(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>
                  {head.map((_, c) => (
                    <td key={c}>{inline(r[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else {
      // a paragraph runs until a blank line or another block; its single newlines stay line breaks
      const para: string[] = [];
      for (; i < lines.length && !isBlank(lines[i]) && (para.length === 0 || !startsBlock(lines[i])); i++) {
        para.push(lines[i].trim());
      }
      out.push(
        <p key={key}>
          {para.map((l, n) => (
            <span key={n}>
              {n > 0 && <br />}
              {inline(l)}
            </span>
          ))}
        </p>
      );
    }
  }
  return out;
}

// escapes, `code`, [text](url), bare URLs, **bold**, ~~strike~~, *italic* — underscores are
// left alone so entity ids like light.living_room never turn italic
const INLINE =
  /\\([\\`*_~[\]()#+\-.!>|])|`([^`]+)`|\[([^\]]+)\]\(\s*<?((?:[^\s()<>]|\([^\s()<>]*\))+)>?(?:\s+"[^"]*")?\s*\)|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"，。！？）])|\*\*(?=\S)([\s\S]*?\S)\*\*|~~(?=\S)([\s\S]*?\S)~~|\*(?=[^\s*])([^*]*?[^\s*])\*/g;

const SAFE_HREF = /^(https?:|mailto:|tel:)/i;

function link(href: string, children: ReactNode, key: number): ReactNode {
  if (!SAFE_HREF.test(href)) return <span key={key}>{children}</span>;
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index!;
    if (at > last) out.push(text.slice(last, at));
    const key = out.length;
    const [, escaped, code, label, href, bare, bold, strike, italic] = m;
    if (escaped !== undefined) out.push(escaped);
    else if (code !== undefined) out.push(<code key={key}>{code}</code>);
    else if (label !== undefined) out.push(link(href, inline(label), key));
    else if (bare !== undefined) out.push(link(bare, bare, key));
    else if (bold !== undefined) out.push(<strong key={key}>{inline(bold)}</strong>);
    else if (strike !== undefined) out.push(<del key={key}>{inline(strike)}</del>);
    else out.push(<em key={key}>{inline(italic)}</em>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
