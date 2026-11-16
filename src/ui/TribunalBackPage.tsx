import { useEffect, useMemo, useState } from 'react';
import { backPageHeadlines, type reviewWeek } from '../lib/tribunal';
import { formatTodayLabel } from '../lib/todayStats';

type Review = ReturnType<typeof reviewWeek>;

function makeCard(headline: string, date: string, totals: string, lift: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Card preview unavailable');
  const paper = '#fbf4e6';
  const ink = '#0b1b35';
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, 1080, 218);
  ctx.fillStyle = paper;
  ctx.font = 'bold 38px system-ui';
  ctx.fillText('EQ FIT', 64, 75);
  ctx.font = 'bold 76px Georgia';
  ctx.fillText('THE BACK PAGE', 64, 170);
  ctx.fillStyle = ink;
  ctx.font = 'bold 34px system-ui';
  ctx.fillText(date, 64, 305, 952);
  ctx.font = 'bold 88px Georgia';
  const words = headline.split(' ');
  let line = '';
  let y = 434;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > 952) {
      ctx.fillText(line, 64, y, 952);
      line = word;
      y += 100;
    } else {
      line = next;
    }
  }
  ctx.fillText(line, 64, y, 952);
  ctx.fillRect(64, 867, 952, 3);
  ctx.font = 'bold 42px system-ui';
  ctx.fillText(totals, 64, 946, 952);
  if (lift) {
    ctx.font = 'bold 36px system-ui';
    ctx.fillText(lift, 64, 1008, 952);
  }
  return canvas;
}

export function TribunalBackPage({ review }: { review: Review }) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('');
  const options = backPageHeadlines(review);
  const headline = options[index % options.length];
  const date = `${formatTodayLabel(review.start)} – ${formatTodayLabel(review.end)}`;
  const totals = review.facts[0];
  const win = review.win;
  const lift = win ? `${win.exercise.name.slice(0, 48)} · ${win.load} kg × ${win.reps} · +${win.reps - win.previousReps} reps vs ${formatTodayLabel(win.previousDate)}` : '';
  const canvas = useMemo(() => {
    try { return headline ? makeCard(headline, date, totals, lift) : null; }
    catch { return null; }
  }, [headline, date, totals, lift]);
  const [failedCanvas, setFailedCanvas] = useState<HTMLCanvasElement>();
  const [image, setImage] = useState<{ canvas: HTMLCanvasElement; url: string; file: File }>();
  useEffect(() => {
    if (!canvas) return;
    let active = true;
    let url: string | undefined;
    canvas.toBlob(blob => {
      if (!active) return;
      if (!blob) { setFailedCanvas(canvas); return; }
      url = URL.createObjectURL(blob);
      setImage({ canvas, url, file: new File([blob], 'eq-fit-back-page.png', { type: 'image/png' }) });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [canvas]);
  const preview = image?.canvas === canvas ? image : undefined;
  if (!headline) return null;
  return <section className="tribunal-back-page" aria-label="Back Page preview">
    <h3>The Back Page</h3>
    {preview ? <img src={preview.url} alt={`EQ Fit Back Page. ${date}. ${headline}. ${totals}. ${lift}`} /> : <p>{canvas && failedCanvas !== canvas ? 'Preparing image…' : 'Image preview unavailable on this device.'}</p>}
    <div className="tribunal-actions">
      <button type="button" onClick={() => { setIndex(value => value + 1); setStatus(''); }}>Another headline</button>
      {preview && <>
        {navigator.canShare?.({ files: [preview.file] }) && <button type="button" onClick={async () => {
          try { await navigator.share({ files: [preview.file] }); }
          catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setStatus('Could not open sharing. Try downloading the card.'); }
        }}>Share image</button>}
        <a className="tribunal-download" href={preview.url} download={preview.file.name}>Download image</a>
      </>}
    </div>
    {status && <p role="status">{status}</p>}
  </section>;
}
