import {it,expect} from 'vitest';
import {syncFailure} from '../src/lib/syncFailure';
it('distinguishes download, validation and local storage without exposing raw messages',()=>{
 expect(syncFailure('download',new Error('secret-token'))).toContain('[download]');
 expect(syncFailure('validation',new Error('private activity'))).toContain('[validation]');
 expect(syncFailure('save',{name:'ConstraintError',message:'private record'})).toContain('[save:ConstraintError]');
 expect(syncFailure('save',{name:'private name',message:'secret'})).not.toContain('secret');
 expect(syncFailure('save',{name:'private name'})).toContain('[save:UnknownError]');
 expect(syncFailure('save',{name:'QuotaExceededError'})).toContain('Save a backup');
});
