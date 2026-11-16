import { useEffect, useState, type FormEvent } from 'react';
import { challenge, dayReply, tribunalPrompt, verdict, type reviewWeek } from '../lib/tribunal';
import { formatTodayLabel } from '../lib/todayStats';
import type { Voice } from '../lib/tribunal';
import './tribunal.css';

type Review = ReturnType<typeof reviewWeek>;
type Model = {
  availability(): Promise<string>;
  create(): Promise<{ prompt(text: string): Promise<string>; destroy(): void }>;
};

const model = () => (globalThis as typeof globalThis & { LanguageModel?: Model }).LanguageModel;

export function Tribunal({ current, previous }: { current: Review; previous: Review }) {
  const [past, setPast] = useState(current.rows.length === 0 && previous.rows.length > 0);
  const review = past ? previous : current;
  return <details className="card tribunal">
    <summary>The Monday Tribunal</summary>
    <div className="tribunal-actions" role="group" aria-label="Review week">
      <button type="button" aria-pressed={!past} onClick={() => setPast(false)}>This week</button>
      <button type="button" aria-pressed={past} onClick={() => setPast(true)}>Last week</button>
    </div>
    <Hearing key={review.start} review={review} />
  </details>;
}

function Hearing({ review }: { review: Review }) {
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
    <p className="muted small">{formatTodayLabel(review.start)} – {formatTodayLabel(review.end)}</p>
    <p className="tribunal-verdict" aria-live="polite">{verdict(review, voice)}</p>
    {review.rows.length > 0 && <>
      <p>{review.facts[0]}</p>
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
      <summary>Talk back</summary>
      <form onSubmit={ask}>
        <label htmlFor="tribunal-reply">Your reply</label>
        <input id="tribunal-reply" value={question} onChange={e => setQuestion(e.target.value)} maxLength={280} placeholder="Give it to me as a headline" />
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
