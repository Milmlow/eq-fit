import type { Joke, Tone } from './coach';
export const CHARACTERS = [
 {id:'dazza',name:'Dazza',description:'Site foreman. Dry as a concrete slab.'},
 {id:'auntie',name:'Savage Auntie',description:'Big heart. Absolutely no filter.'},
 {id:'commentator',name:'The Commentator',description:'Your session. Unnecessary live coverage.'},
 {id:'coach',name:'Coach EQ',description:'The original clipboard with an attitude.'},
] as const;
export type Character = typeof CHARACTERS[number]['id'];
export function characterFor(value:unknown):Character {return CHARACTERS.some(c=>c.id===value)?value as Character:'coach';}
// Original material: general lines work between sessions without inventing workout facts.
const material:Record<Exclude<Character,'coach'>,Record<Exclude<Tone,'off'>,string[]>> = {
 dazza:{
  friendly:["Morning. I’ve done the risk assessment. Biggest hazard is me explaining the risk assessment.","The dumbbells have no Wi-Fi. Finally, equipment that won’t request an update.","I’ve brought a clipboard to the gym. Nobody knows what I do, but they’re calling me boss.","My coaching qualification is a high-vis vest. You’d be surprised how far that gets you.","The gym has a functional training area. Mine at home is called bringing all the groceries in one trip.","Rest day approved. I’ll be supervising mine horizontally."],
  cheeky:["We’re calling this a toolbox talk. Mostly because I’ve brought the tools and done all the talking.","The mirror’s been watching all morning. Still hasn’t offered to spot anyone.","I’ve renamed my rest timer ‘procurement’. Nobody questions a delay in procurement.","Gym influencers call it a training split. On site we call it disappearing after lunch.","I’ve submitted my abs for inspection. The assessor has requested better lighting.","A shaker bottle isn’t a qualification, mate. Otherwise my dishwasher’s a personal trainer."],
  filthy:["The mirror inspection is not a fourth fucking set, mate.","My rest timer’s gone into project management. Three minutes late and blaming another fucking trade.","Who named it a Bulgarian split squat? I’d like a fucking word with their tourism board.","New gym policy: anyone saying ‘let’s circle back’ has to carry the fucking plates.","I bought performance socks. Still the same dickhead, just moisture-wicking.","My protein shaker’s been in the ute since Monday. It’s developing a fucking enterprise agreement."],
 },
 auntie:{
  friendly:["I brought moral support. It’s in the same bag as my unsolicited opinions.","Darling, these gym mirrors are very confident for something that never helps tidy up.","My fitness watch says I need recovery. Finally, someone in this family understands me.","I’ve dressed for Pilates. Whether Pilates happens is between me and the outfit.","I call it a wellness retreat. The family calls it not answering my phone.","Your gym bag has compartments. Mine has archaeological periods."],
  cheeky:["Darling, a matching gym set is lovely. Unfortunately the dumbbells are immune to styling.","I’ve booked a recovery session. It’s a chair and nobody asking me where things are.","The gym mirror and I have an agreement. I provide flattering lighting; it keeps its opinions to itself.","My watch called me unproductive. Bold words from something I have to charge every night.","I’ve started resistance training. Mostly resisting people who say ‘summer bodies’.","Sweetheart, that shaker bottle has been in your bag long enough to qualify as a dependent."],
  filthy:["Darling, I love a fitness journey. Mine currently includes telling my watch to fuck off.","That gym mirror has seen some shit. And somehow still looks more composed than the rest of us.","I bought sculpting leggings. Apparently I’m still expected to do the fucking sculpting.","My recovery routine is magnesium, a bath, and absolutely none of your fucking business.","A man explained my own workout to me. Lovely. I’ve always wanted a podcast I couldn’t turn the fuck off.","My watch says ‘stand up’. Darling, I’ve spent decades being told what to do. Get fucked."],
 },
 commentator:{
  friendly:["We cross live to the gym floor, where a towel has reserved a bench without completing a single rep.","The water bottle has arrived. Hydration’s management team is refusing further comment.","A dramatic pause by the dumbbells. We understand it’s called a rest period.","The headphones are in. Contact with the outside world has been officially suspended.","The rest timer has sounded. Nobody in the commentary box is volunteering to enforce it.","We apologise for the lack of slow-motion replay. This is already the speed it happened."],
  cheeky:["We cross to the foam roller, where an adult is voluntarily losing an argument with a tube.","The shaker bottle is receiving more airtime than the actual workout. Sponsors will be delighted.","The towel has held that bench for twelve minutes. A dominant defensive performance.","The playlist has been changed again. A tactical masterclass in avoiding the next set.","The rest timer has entered extra time. We may be here all afternoon.","We’ve consulted the video referee. Walking past the squat rack does not count as leg day."],
  filthy:["We cross live to the foam roller. The floor is winning. The language is fucking extraordinary.","The rest timer has entered its third overtime. Even the fucking ads have gone home.","A sensational display from the gym towel. It’s occupied three machines and done fuck-all.","The headphones have disconnected. The entire gym now knows about the fucking power ballads.","The commentators are reviewing the footage. Mostly to find out who left this shit on the bar.","The shaker bottle’s been opened. We’re evacuating the fucking commentary box."],
 },
};
export function characterJokes(character:Character):Joke[] {
 if(character==='coach')return [];
 return (Object.entries(material[character]) as [Exclude<Tone,'off'>,string[]][]).flatMap(([tone,texts])=>texts.map((text,i)=>({
  id:`${character}-${tone}-${i+1}`,character,text,tone,event:'visit' as const,
  expression:(['eyebrow','clipboard','proud'] as const)[i%3],requiredFacts:[],exclusions:[],cooldownDays:14,fallback:'Your training tools are ready.',
 })));
}
