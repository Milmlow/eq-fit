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
 const html=render(entry('strength',[]));expect(html).toContain('body-tags');expect(html.split('class="body-tags"')[1].split('</div>')[0].match(/aria-pressed="false"/g)).toHaveLength(6);
});
it('shows this week before body coverage and exposes cardio allocation choices',()=>{
 const html=render(entry('cardio',[]));expect(html).toContain('Cardio · Choose activity');expect(html).toContain('Walking</button>');expect(html.indexOf('This week')).toBeLessThan(html.indexOf('Whole-body coverage'));
});
const cycling=():TrainingEntry=>({id:'c',date:'2026-11-04',order:'',title:'Cycling',category:'cardio',sets:[],activity:{id:'c',date:'2026-11-04',original_type:'Cycling',duration_seconds:3600} as TrainingEntry['activity']});
const renderMany=(es:TrainingEntry[])=>renderToStaticMarkup(createElement(FreeTraining,{repo:{} as Repo,today:'2026-11-05',entries:es,days:1,onChanged:()=>{}}));
it('collapses sessions and coverage into the weekly effort once every session is sorted',()=>{
 const html=renderMany([cycling()]);
 expect(html).toContain('aria-label="Weekly effort"');expect(html).toContain('1h 00m');expect(html).toContain('All sorted · 1 session');
 expect(html).toMatch(/<details class="settled-sessions">/);expect(html).not.toMatch(/<details class="settled-sessions" open/);
 expect(html).toMatch(/<details class="coverage-fold">/);expect(html).not.toContain('Choose activity');
});
it('keeps sessions that still need input visible above the collapsed rest',()=>{
 const html=renderMany([entry('cardio',[]),cycling()]);
 expect(html.indexOf('Choose activity')).toBeLessThan(html.indexOf('<details class="settled-sessions">'));
 expect(html.indexOf('<details class="settled-sessions">')).toBeLessThan(html.indexOf('Cardio · Cycling'));
 expect(html).toContain('1 session needs your input');expect(html).toMatch(/<details class="coverage-fold" open/);
});
it('shows unknown time as - and not 0 min when nothing has a duration',()=>{
 const html=render(entry('cardio',[]));expect(html).not.toContain('0 min');expect(html).toContain('Active time</span>');
});
