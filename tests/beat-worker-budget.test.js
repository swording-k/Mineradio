'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/js/modules/03-beat/00-tempo-worker-cache-prefetch.js','utf8');
function harness(){
 const workers=[];
 class Worker { constructor(){workers.push(this)} postMessage(data){this.data=data} terminate(){this.terminated=true} }
 const context=vm.createContext({Worker,Blob:class{},URL:{createObjectURL:()=> 'blob:fixture'},location:{origin:'http://localhost'},
   setTimeout,clearTimeout,setInterval,clearInterval,console,beatMapToken:1,showBeatChip(){},yieldToIdle:async()=>{},isHiddenForBackgroundOptimization:()=>false});
 vm.runInContext(source.slice(source.indexOf('var musicTempoWorkerUrl'),source.indexOf('function scheduleBeatAnalysis')),context);
 return {context,workers};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function buffer(seconds){return {sampleRate:44100,length:44100*seconds,numberOfChannels:1,getChannelData:()=>new Proxy({}, {get:()=>0})};}
test('tempo analysis caps PCM duration and sample rate before starting its worker',async()=>{
 const {context,workers}=harness();
 const result=context.analyzeMusicTempoInWorker(buffer(600),1);
 await flush();
 try {
   assert.equal(workers.length,1);
   assert(workers[0].data.sampleRate<=22050);
   assert(workers[0].data.mono.byteLength<=22050*90*4,'a ten-minute track must not be copied whole into the tempo worker');
 } finally {workers[0].onmessage({data:{ok:true,beats:[]}});await result;}
});
test('a new track terminates the old tempo worker and settles its pending analysis',async()=>{
 const {context,workers}=harness();
 const first=context.analyzeMusicTempoInWorker(buffer(1),1);await flush();
 context.beatMapToken=2;
 const second=context.analyzeMusicTempoInWorker(buffer(1),2);await flush();
 try {
   assert.equal(workers[0].terminated,true,'stale workers cannot keep consuming memory after a track switch');
   assert.equal(await first,null);
 } finally {workers.forEach(w=>w.onmessage({data:{ok:true,beats:[]}}));await second;}
});
