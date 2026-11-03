import {useState} from 'react';
export function Feedback(){
 const [choice,setChoice]=useState('Useful'),[note,setNote]=useState(''),[message,setMessage]=useState(''),[draft,setDraft]=useState('');
 const text=()=>`EQ Fit feedback: ${choice}${note.trim()?'\n'+note.trim():''}`;
 async function copy(){const body=text();try{await navigator.clipboard.writeText(body);setMessage('Copied. Paste it into your message to Royce.');}catch{setDraft(body);setMessage('Select and copy the feedback below.');}}
 async function share(){try{await navigator.share({title:'EQ Fit feedback',text:text()});setMessage('Share dialog closed.');}catch{setMessage('Nothing confirmed sent. You can copy the feedback instead.');}}
 return <details className="card"><summary>Help shape EQ Fit</summary><p>How is it going?</p><div className="feedback-options">{['Useful','Confusing','Missing something'].map(c=><button key={c} aria-pressed={choice===c} onClick={()=>setChoice(c)}>{c==='Useful'?'👍':c==='Confusing'?'?':'+'} {c}</button>)}</div><label className="field">Optional note<textarea maxLength={1500} value={note} onChange={e=>setNote(e.target.value)} rows={3}/></label><div className="row gap wrap"><button onClick={()=>void copy()}>Copy feedback</button>{typeof navigator.share==='function'&&<button onClick={()=>void share()}>Share feedback</button>}</div><p className="muted small">Choose your own message app to send this to Royce. EQ Fit does not collect or automatically submit it.</p>{message&&<p role="status">{message}</p>}{draft&&<textarea aria-label="Feedback to copy" readOnly value={draft}/>}</details>;
}
