/** Simple markdown → HTML renderer for LLM output preview */
export function renderMarkdown(md: string): string {
  let html = md
    // Headings
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered list items
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Paragraphs (double newline)
    .replace(/\n\n/g, "</p><p>")
    // Single newlines within paragraphs
    .replace(/\n/g, "<br/>");

  // Wrap list items
  html = html.replace(/(<li>.*?<\/li>(?:<br\/>)?)+/g, (match) => `<ul>${match.replace(/<br\/>/g, "")}</ul>`);

  // Handle markdown tables
  html = html.replace(
    /(\|.+\|(?:<br\/>)?)+/g,
    (tableBlock) => {
      const rows = tableBlock.split(/<br\/>/).filter((r) => r.trim().startsWith("|"));
      if (rows.length < 2) return tableBlock;

      const parseRow = (row: string) =>
        row.split("|").map((c) => c.trim()).filter((c) => c.length > 0);

      const headers = parseRow(rows[0]);
      // Skip separator row
      const startIdx = rows[1].replace(/[\s|:-]/g, "").length === 0 ? 2 : 1;
      const bodyRows = rows.slice(startIdx);

      let table = "<table><thead><tr>";
      for (const h of headers) table += `<th>${h}</th>`;
      table += "</tr></thead><tbody>";
      for (const row of bodyRows) {
        const cells = parseRow(row);
        table += "<tr>";
        for (const c of cells) table += `<td>${c}</td>`;
        table += "</tr>";
      }
      table += "</tbody></table>";
      return table;
    },
  );

  return `<p>${html}</p>`;
}
