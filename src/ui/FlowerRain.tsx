import {useState} from 'react';
/** A brief decorative shower, with no hit targets over workout controls. */
export function FlowerRain(){
 const [burst,setBurst]=useState(0);
 return <><div key={burst} className="flower-rain" aria-hidden="true">{Array.from({length:18},(_,i)=><span key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%6)*.12}s`,fontSize:`${20+(i%4)*5}px`}}>{['🌸','🌼','💮'][i%3]}</span>)}</div><button className="flower-replay" aria-label="Shower of flowers" title="Girl Power · flower shower" onClick={()=>setBurst(n=>n+1)}>🌸</button></>;
}
