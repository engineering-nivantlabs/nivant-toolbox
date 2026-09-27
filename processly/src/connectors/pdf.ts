import PDFDocument from 'pdfkit';
import { resolve } from '../expr.js';

/**
 * Document templates are Markdown with {{ expressions }} and
 * {{#each expr}} … {{/each}} blocks (inside, `item` is the current element).
 * Supported layout: # / ## headings, paragraphs, - bullets, | tables |, ---, **bold**.
 */
export async function renderTemplate(template: string, ctx: Record<string, unknown>): Promise<string> {
  const EACH = /\{\{#each\s+([\s\S]+?)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  let out = '';
  let last = 0;
  for (const m of template.matchAll(EACH)) {
    out += await resolve(template.slice(last, m.index), ctx);
    const items = await resolve(`{{ ${m[1]} }}`, ctx);
    for (const [i, item] of (Array.isArray(items) ? items : []).entries()) out += await resolve(m[2], { ...ctx, item, index: i });
    last = m.index! + m[0].length;
  }
  return out + await resolve(template.slice(last), ctx);
}

function inline(doc: PDFKit.PDFDocument, text: string, opts: PDFKit.Mixins.TextOptions = {}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  parts.forEach((p, i) => {
    const bold = p.startsWith('**') && p.endsWith('**');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(bold ? p.slice(2, -2) : p, { ...opts, continued: i < parts.length - 1 });
  });
}

export function markdownToPdf(markdown: string, title: string): Promise<Buffer> {
  return new Promise((resolvePdf, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: title, Producer: 'Processly' } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const lines = markdown.replace(/\r/g, '').split('\n');
    let para: string[] = [];
    const flush = () => {
      if (para.length) { doc.fontSize(10.5).fillColor('#1e293b'); inline(doc, para.join(' '), { lineGap: 2 }); doc.moveDown(0.6); }
      para = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();
      if (/^#\s/.test(line)) { flush(); doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(line.slice(2)); doc.moveDown(0.5); }
      else if (/^##\s/.test(line)) { flush(); doc.moveDown(0.3).font('Helvetica-Bold').fontSize(13).fillColor('#0f172a').text(line.slice(3)); doc.moveDown(0.3); }
      else if (/^-{3,}$/.test(line)) { flush(); doc.moveDown(0.3).strokeColor('#cbd5e1').moveTo(doc.x, doc.y).lineTo(doc.x + width, doc.y).stroke(); doc.moveDown(0.6); }
      else if (/^[-*]\s/.test(line)) { flush(); doc.fontSize(10.5).fillColor('#1e293b'); inline(doc, `•  ${line.slice(2)}`, { indent: 10, lineGap: 2 }); }
      else if (/^\|/.test(line)) {
        flush();
        const rows: string[][] = [];
        while (i < lines.length && /^\|/.test(lines[i].trim())) {
          const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
          if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
          i++;
        }
        i--;
        const cols = Math.max(...rows.map(r => r.length));
        const colW = width / cols;
        rows.forEach((r, ri) => {
          const y = doc.y;
          let h = 0;
          r.forEach((cell, ci) => {
            doc.font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor('#1e293b');
            const align = ci > 0 && /^[\d$€£₹.,%\s-]+$/.test(cell) ? 'right' : 'left';
            doc.text(cell, doc.page.margins.left + ci * colW + 4, y + 4, { width: colW - 8, align });
            h = Math.max(h, doc.y - y);
          });
          doc.strokeColor(ri === 0 ? '#94a3b8' : '#e2e8f0').moveTo(doc.page.margins.left, y + h + 4).lineTo(doc.page.margins.left + width, y + h + 4).stroke();
          doc.x = doc.page.margins.left;
          doc.y = y + h + 6;
        });
        doc.moveDown(0.6);
      }
      else if (!line.trim()) flush();
      else para.push(line.trim());
    }
    flush();
    doc.end();
  });
}
