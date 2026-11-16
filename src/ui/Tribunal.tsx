import { useEffect, useRef, useState, type FormEvent } from 'react';
import { challenge, dayReply, raceCall, recapStats, tribunalPrompt, verdict, type reviewWeek } from '../lib/tribunal';
import { formatTodayLabel } from '../lib/todayStats';
import type { Voice } from '../lib/tribunal';
import { TribunalBackPage } from './TribunalBackPage';
import './tribunal.css';

type Layout = 'scoreboard' | 'case-file';

function readLayout(): Layout {
  try { if (localStorage.getItem('eqfit.tribunal.layout') === 'case-file') return 'case-file'; }
  catch { /* Layout still works for this visit. */ }
  return 'scoreboard';
}

type Review = ReturnType<typeof reviewWeek>;
type Model = {
  availability(): Promise<string>;
  create(): Promise<{ prompt(text: string): Promise<string>; destroy(): void }>;
};

const model = () => (globalThis as typeof globalThis & { LanguageModel?: Model }).LanguageModel;

export function Tribunal({ current, previous }: { current: Review; previous: Review }) {
  const [past, setPast] = useState(current.rows.length === 0 && previous.rows.length > 0);
  const [layout, setLayout] = useState<Layout>(readLayout);
  const [open, setOpen] = useState(false);
  const review = past ? previous : current;
  function chooseLayout(value: Layout) {
    setLayout(value);
    try { localStorage.setItem('eqfit.tribunal.layout', value); }
    catch { /* Layout still works for this visit. */ }
  }
  return <details className="card tribunal" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>The Monday Tribunal</summary>
    <div className="tribunal-actions" role="group" aria-label="Review week">
      <button type="button" aria-pressed={!past} onClick={() => setPast(false)}>This week</button>
      <button type="button" aria-pressed={past} onClick={() => setPast(true)}>Last week</button>
    </div>
    <div className="tribunal-actions" role="group" aria-label="Recap layout">
      <button type="button" aria-pressed={layout === 'scoreboard'} onClick={() => chooseLayout('scoreboard')}>Scoreboard</button>
      <button type="button" aria-pressed={layout === 'case-file'} onClick={() => chooseLayout('case-file')}>Case File</button>
    </div>
    {open && <Hearing key={review.start} review={review} layout={layout} />}
  </details>;
}

function Hearing({ review, layout }: { review: Review; layout: Layout }) {
  const [showBackPage, setShowBackPage] = useState(false);
  const callRef = useRef<SpeechSynthesisUtterance>();
  const [audio, setAudio] = useState<'idle' | 'playing' | 'unavailable'>('idle');
  const [voice, setVoice] = useState<Voice>('tribunal');
  const [showChallenge, setShowChallenge] = useState(false);
  const [task, setTask] = useState<ReturnType<typeof challenge>>();
  const [question, setQuestion] = useState('');
  const [modelExchange, setModelExchange] = useState<{ question: string; answer: string }>();
  const [exchange, setExchange] = useState<{ question: string; answer: string }>();
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [deviceAI, setDeviceAI] = useState(false);
  useEffect(() => {
    let live = true;
    void model()?.availability().then(value => {
      if (live) setDeviceAI(['available', 'downloadable', 'downloading'].includes(value));
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (!call) return;
      call.onend = null;
      call.onerror = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  function hearCall() {
    const speech = window.speechSynthesis;
    if (audio === 'playing') {
      if (callRef.current) callRef.current.onerror = null;
      speech.cancel();
      callRef.current = undefined;
      setAudio('idle');
      return;
    }
    const voices = speech?.getVoices().filter(voice => voice.localService) ?? [];
    const localVoice = voices.find(voice => voice.lang === 'en-AU') ?? voices.find(voice => voice.lang.startsWith('en'));
    if (!localVoice) {
      setAudio('unavailable');
      return;
    }
    const call = new SpeechSynthesisUtterance(raceCall(review));
    call.voice = localVoice;
    call.lang = localVoice.lang;
    call.onend = () => { callRef.current = undefined; setAudio('idle'); };
    call.onerror = () => { callRef.current = undefined; setAudio('unavailable'); };
    callRef.current = call;
    setAudio('playing');
    speech.speak(call);
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || pending) return;
    const reply = question.trim();
    setPrompt('');
    setCopied(false);
    const evidence = dayReply(review, reply);
    if (evidence) {
      setExchange({ question: reply, answer: evidence });
      setQuestion('');
      return;
    }
    const request = tribunalPrompt([...review.facts, ...review.dailyFacts], voice, reply, modelExchange);
    const provider = model();
    if (!deviceAI || !provider) {
      setPrompt(request);
      return;
    }
    setPending(true);
    try {
      const session = await provider.create();
      try {
        const answer = await session.prompt(request);
        setExchange({ question: reply, answer });
        setModelExchange({ question: reply, answer });
        setQuestion('');
      } finally {
        session.destroy();
      }
    } catch {
      setPrompt(request);
    } finally {
      setPending(false);
    }
  }

  return <>
    <section className={`tribunal-match tribunal-${layout}`} aria-label={layout === 'scoreboard' ? 'Scoreboard' : 'Case File'}>
      <p className="tribunal-period">{formatTodayLabel(review.start)} – {formatTodayLabel(review.end)}</p>
      {layout === 'case-file' && review.rows.length > 0 && <strong className="tribunal-stamp">Verdict in</strong>}
      {review.rows.length > 0 && (layout === 'scoreboard' ? <dl className="tribunal-score">
        {recapStats(review).map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.count}</dd></div>)}
      </dl> : <p>{review.facts[0]}</p>)}
      {review.win && <p className="tribunal-lift"><strong>{review.win.exercise.name} · {review.win.load} kg × {review.win.reps}</strong><br />
        +{review.win.reps - review.win.previousReps} {review.win.reps - review.win.previousReps === 1 ? 'rep' : 'reps'} at this load vs {formatTodayLabel(review.win.previousDate)}
      </p>}
      <p className="tribunal-verdict" aria-live="polite">{verdict(review, voice)}</p>
    </section>
    {review.rows.length > 0 && <>
      <div className="tribunal-actions">
        {(layout === 'scoreboard' || audio === 'playing') && <button type="button" onClick={hearCall}>{audio === 'playing' ? 'Stop call' : 'Hear the call'}</button>}
        <button type="button" aria-expanded={showBackPage} onClick={() => setShowBackPage(value => !value)}>Back Page</button>
      </div>
      {audio === 'unavailable' && layout === 'scoreboard' && <p role="status">{raceCall(review)}</p>}
      {showBackPage && <TribunalBackPage review={review} />}
      <details>
        <summary>Show your evidence</summary>
        <ul>{review.facts.slice(1).map(fact => <li key={fact}>{fact}</li>)}</ul>
        <ul>{review.rows.map(row =>
          <li key={row.id}>{formatTodayLabel(row.date)} · {row.title} · {row.category === 'run' ? 'Run' : row.category}</li>
        )}</ul>
      </details>
      <label className="tribunal-voice">Commentator <select value={voice} onChange={e => setVoice(e.target.value as Voice)}>
        <option value="tribunal">The Tribunal</option>
        <option value="race">Race caller</option>
        <option value="foreman">Site foreman</option>
      </select></label>
    </>}
    <button type="button" aria-expanded={showChallenge} onClick={() => setShowChallenge(value => !value)}>Set me a challenge</button>
    {showChallenge && <>
      <div className="tribunal-actions" role="group" aria-label="Challenge type">
        <button type="button" onClick={() => setTask(challenge('variety'))}>Mix it up</button>
        <button type="button" onClick={() => setTask(challenge('consistency'))}>Show up</button>
        <button type="button" onClick={() => setTask(challenge('strength'))}>Track a lift</button>
      </div>
      {task && <p role="status">{task}</p>}
    </>}
    {review.rows.length > 0 && <details className="tribunal-ask">
      <summary>{layout === 'case-file' ? 'Object' : 'Talk back'}</summary>
      <form onSubmit={ask}>
        <label htmlFor="tribunal-reply">Your reply</label>
        <input id="tribunal-reply" value={question} onChange={e => setQuestion(e.target.value)} maxLength={280} placeholder={layout === 'case-file' ? 'Check Friday' : 'Give it to me as a headline'} />
        <button type="submit" disabled={!question.trim() || pending}>{pending ? 'Writing…' : deviceAI ? 'Ask on this device' : 'Prepare ChatGPT prompt'}</button>
      </form>
      {exchange && <div role="status"><p><strong>You</strong> · {exchange.question}</p><p>{exchange.answer}</p></div>}
      {prompt && <>
        <label htmlFor="tribunal-prompt">Review and copy into ChatGPT</label>
        <textarea id="tribunal-prompt" rows={6} readOnly value={prompt} onFocus={e => e.target.select()} />
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(prompt); setCopied(true); }
          catch { document.getElementById('tribunal-prompt')?.focus(); }
        }}>{copied ? 'Copied' : 'Copy prompt'}</button>
      </>}
    </details>}
  </>;
}
