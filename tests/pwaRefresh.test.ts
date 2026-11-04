import {it,expect,vi,afterEach} from 'vitest';
import {refreshApp} from '../src/pwa';
afterEach(()=>vi.unstubAllGlobals());
function setup(reg?:unknown,online=true){
 const reload=vi.fn();const sw=new EventTarget();
 Object.assign(sw,{getRegistration:vi.fn().mockResolvedValue(reg)});
 vi.stubGlobal('navigator',{onLine:online,serviceWorker:sw});vi.stubGlobal('window',{location:{reload}});
 return {reload,sw};
}
it('reloads when no service worker is registered',async()=>{
 const {reload}=setup();await refreshApp();expect(reload).toHaveBeenCalledOnce();
});
it('checks for updates before reloading an up-to-date app',async()=>{
 const update=vi.fn().mockResolvedValue(undefined);const {reload}=setup({update});
 await refreshApp();expect(update).toHaveBeenCalledOnce();expect(reload).toHaveBeenCalledOnce();
});
it('activates a waiting worker before reloading',async()=>{
 const reg={update:vi.fn().mockResolvedValue(undefined),waiting:{postMessage:vi.fn()}};
 const {reload,sw}=setup(reg);reg.waiting.postMessage.mockImplementation(()=>{expect(reload).not.toHaveBeenCalled();sw.dispatchEvent(new Event('controllerchange'));});
 await refreshApp();expect(reg.waiting.postMessage).toHaveBeenCalledWith({type:'SKIP_WAITING'});expect(reload).toHaveBeenCalledOnce();
});
it('keeps the page open if offline or update fails',async()=>{
 const {reload}=setup(undefined,false);await expect(refreshApp()).rejects.toThrow('offline');expect(reload).not.toHaveBeenCalled();
 const next=setup({update:vi.fn().mockRejectedValue(new Error('Network failed'))});await expect(refreshApp()).rejects.toThrow('Network failed');expect(next.reload).not.toHaveBeenCalled();
});
it('waits for an in-flight download before activating',async()=>{
 const worker=Object.assign(new EventTarget(),{state:'installing',postMessage:vi.fn()});
 const reg={update:vi.fn().mockResolvedValue(undefined),installing:worker,waiting:null as typeof worker|null};
 const {reload,sw}=setup(reg);worker.postMessage.mockImplementation(()=>sw.dispatchEvent(new Event('controllerchange')));
 const result=refreshApp();await new Promise(resolve=>setTimeout(resolve,0));expect(reload).not.toHaveBeenCalled();
 reg.waiting=worker;worker.state='installed';worker.dispatchEvent(new Event('statechange'));
 await result;expect(reload).toHaveBeenCalledOnce();
});
