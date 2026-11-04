import {it,expect} from 'vitest';
import {freshRepo} from './helpers';
import {prepareTrialRows,prepareCloudRows} from '../src/lib/cloudImport';
it('opens an empty dashboard when Garmin returns zero matching activities',async()=>{
 const repo=await freshRepo();
 expect(await prepareTrialRows([],repo)).toEqual([]);
 expect(await prepareCloudRows([],repo)).toEqual([]);
 repo.db.close();
});
