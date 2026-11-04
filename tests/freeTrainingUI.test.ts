import {createElement} from 'react';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {FreeTraining} from '../src/ui/FreeTraining';
import type {TrainingEntry} from '../src/lib/dashboardFocus';
import type {Repo} from '../src/db/repo';
const entry=(category:TrainingEntry['category'],parts:string[]):TrainingEntry=>({id:'a',date:'2026-11-05',order:'',title:'Sydney Running',category,sets:[],workout:{id:'w',body_parts:parts} as TrainingEntry['workout']});
const render=(e:TrainingEntry)=>renderToStaticMarkup(createElement(FreeTraining,{repo:{} as Repo,today:'2026-11-05',entries:[e],days:1,onChanged:()=>{}}));
it('renders a run without a muscle picker or muscle coverage even with legacy tags',()=>{
 const html=render(entry('run',['Legs']));expect(html).toContain('<strong>Running</strong>');expect(html).not.toContain('body-tags');expect(html).not.toContain('body-covered');expect(html).not.toContain('Edit body parts');
});
it('collapses saved strength tags and offers Edit',()=>{
 const html=render(entry('strength',['Shoulders']));expect(html).not.toContain('body-tags');expect(html).toContain('Shoulders</span>');expect(html).toContain('Edit body parts');
});
it('shows choices for an untagged strength session',()=>{
 const html=render(entry('strength',[]));expect(html).toContain('body-tags');expect(html.match(/aria-pressed="false"/g)).toHaveLength(6);
});
