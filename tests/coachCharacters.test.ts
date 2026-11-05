import {describe,it,expect} from 'vitest';
import {CHARACTERS,characterFor,characterJokes} from '../src/lib/coachCharacters';
import {choose,freshCoach,rateCoach} from '../src/lib/coach';
describe('character voices',()=>{
 it('keeps existing profiles on their original coach',()=>{expect(characterFor(undefined)).toBe('coach');expect(characterFor('bad')).toBe('coach');});
 it('rotates each character in the selected tone through every session context',()=>{
  for(const character of CHARACTERS.filter(c=>c.id!=='coach'))for(const tone of ['friendly','cheeky','filthy'] as const)for(const event of ['visit','run','weights'] as const){
   let state={...freshCoach(),tone};let previous='';
   const pool=characterJokes(character.id);const ctx={key:'test',aliases:[],event};
   for(let i=0;i<30;i++){
    const next=choose(state,ctx,Date.now(),true,pool);
    expect(next.joke?.tone).toBe(tone);expect(next.joke?.character).toBe(character.id);expect(next.joke?.id).not.toBe(previous);
    previous=next.joke!.id;state=next.state as typeof state;
   }
   const disliked=pool.find(j=>j.id===previous)!;
   state=rateCoach(state,disliked,'not-funny','2026-11-05') as typeof state;
   for(let i=0;i<10;i++){const next=choose(state,ctx,Date.now(),true,pool);expect(next.joke?.id).not.toBe(disliked.id);state=next.state as typeof state;}
  }
 });
});
