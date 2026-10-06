import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders the light markup used in article fields.
 *
 * Supported syntax: blank-line paragraphs, `- ` bullets, `1. ` numbered lists,
 * `> ` quotes, `### ` sub-headings, and inline **bold**, *italic*, `code` and
 * [links](url).
 *
 * Deliberately not an HTML sink: everything becomes React elements, so a
 * contributor cannot inject markup, and links are restricted to http(s) so a
 * `javascript:` URL degrades to plain text instead of becoming clickable.
 */

const SAFE_URL = /^https?:\/\/[^\s]+$/i;

type Inline = { kind: "text" | "strong" | "em" | "code" | "link"; text: string; href?: string };

function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    if (match.index > last) out.push({ kind: "text", text: source.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith("**")) out.push({ kind: "strong", text: token.slice(2, -2) });
    else if (token.startsWith("`")) out.push({ kind: "code", text: token.slice(1, -1) });
    else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        if (SAFE_URL.test(href)) out.push({ kind: "link", text: label, href });
        else out.push({ kind: "text", text: label });
      } else out.push({ kind: "text", text: token });
    } else out.push({ kind: "em", text: token.slice(1, -1) });
    last = match.index + token.length;
  }
  if (last < source.length) out.push({ kind: "text", text: source.slice(last) });
  return out;
}

function renderInline(source: string, keyPrefix: string): ReactNode[] {
  return parseInline(source).map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.kind) {
      case "strong":
        return <strong key={key}>{node.text}</strong>;
      case "em":
        return <em key={key}>{node.text}</em>;
      case "code":
        return <code key={key}>{node.text}</code>;
      case "link":
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {node.text}
          </a>
        );
      default:
        return <span key={key}>{node.text}</span>;
    }
  });
}

interface Block {
  type: "p" | "ul" | "ol" | "quote" | "h" | "table";
  lines: string[];
}

/** A pipe table is any block where every line starts and ends with `|`. */
function isTable(lines: string[]): boolean {
  return lines.length >= 2 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l));
}

function parseRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseBlocks(source: string): Block[] {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const blocks: Block[] = [];
  for (const chunk of normalized.split(/\n{2,}/)) {
    const lines = chunk.split("\n");
    const bullet = lines.every((l) => /^\s*[-*]\s+/.test(l));
    const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
    const quote = lines.every((l) => /^\s*>\s?/.test(l));
    const heading = lines.length === 1 && /^#{2,4}\s+/.test(lines[0]);
    if (isTable(lines)) {
      blocks.push({ type: "table", lines });
    } else if (heading) {
      blocks.push({ type: "h", lines: [lines[0].replace(/^#{2,4}\s+/, "")] });
    } else if (bullet) {
      blocks.push({ type: "ul", lines: lines.map((l) => l.replace(/^\s*[-*]\s+/, "")) });
    } else if (numbered) {
      blocks.push({ type: "ol", lines: lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, "")) });
    } else if (quote) {
      blocks.push({ type: "quote", lines: lines.map((l) => l.replace(/^\s*>\s?/, "")) });
    } else {
      blocks.push({ type: "p", lines });
    }
  }
  return blocks;
}

export function RichText({ value, className }: { value: string; className?: string }) {
  const blocks = parseBlocks(value);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        if (block.type === "table") {
          const rows = block.lines.map(parseRow);
          const [head, ...body] = rows.filter(
            (row, i) => i !== 1 || !row.every((cell) => /^-{2,}$/.test(cell.replace(/:/g, ""))),
          );
          return (
            <div key={key} className="scroll-x my-4 rounded-control border border-line">
              <table className="w-full border-collapse text-[0.8125rem]">
                <thead>
                  <tr className="bg-sunken text-left">
                    {head.map((cell, ci) => (
                      <th key={ci} scope="col" className="border-b border-line px-3 py-2 font-semibold text-ink">
                        {renderInline(cell, `${key}-h-${ci}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri} className="border-b border-line-soft last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 align-top text-ink-2">
                          {renderInline(cell, `${key}-${ri}-${ci}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === "h") return <h3 key={key}>{renderInline(block.lines[0], key)}</h3>;
        if (block.type === "ul")
          return (
            <ul key={key}>
              {block.lines.map((l, li) => (
                <li key={`${key}-${li}`}>{renderInline(l, `${key}-${li}`)}</li>
              ))}
            </ul>
          );
        if (block.type === "ol")
          return (
            <ol key={key}>
              {block.lines.map((l, li) => (
                <li key={`${key}-${li}`}>{renderInline(l, `${key}-${li}`)}</li>
              ))}
            </ol>
          );
        if (block.type === "quote")
          return <blockquote key={key}>{renderInline(block.lines.join(" "), key)}</blockquote>;
        return (
          <p key={key}>
            {block.lines.map((l, li) => (
              <span key={`${key}-${li}`}>
                {renderInline(l, `${key}-${li}`)}
                {li < block.lines.length - 1 ? " " : null}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Small helper for places that need the plain text of a markup field. */
export function markupToPlain(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{2,4}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\|/gm, "")
    .replace(/\|\s*$/gm, "")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim();
}

export { Link };
