// Browser file helpers. Text is handed to the browser as a Blob; nothing is uploaded anywhere.
export function dated(prefix: string, ext: string, now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.${ext}`;
}

export function saveTextFile(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Share sheet with the file attached (iPhone: "Save to Files"), when the browser supports sharing files. */
export function canShareFile(name: string, mime: string): boolean {
  try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], name, { type: mime })] }); } catch { return false; }
}
export async function shareTextFile(name: string, text: string, mime: string): Promise<boolean> {
  try { await navigator.share({ files: [new File([text], name, { type: mime })], title: name }); return true; } catch { return false; }
}
