// Tiny synthesized sound effects (Web Audio, no audio files). Mute is remembered per device.
window.snoomySound = (() => {
 const KEY='snoomy-sound';
 let context,muted=false;
 try{muted=localStorage.getItem(KEY)==='off';}catch{}
 const audio=()=>{
  if(!context){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;context=new Audio();}
  if(context.state==='suspended')context.resume();
  return context;
 };
 // Browsers only start audio after a tap, so the first interaction unlocks it.
 addEventListener('pointerdown',()=>{if(!muted)audio();},{once:true,capture:true});

 function tone(c,{type='sine',from,to=from,start=0,length=.15,gain=.1,attack=.005}){
  const t=c.currentTime+start,oscillator=c.createOscillator(),volume=c.createGain();
  oscillator.type=type;oscillator.frequency.setValueAtTime(from,t);
  if(to!==from)oscillator.frequency.exponentialRampToValueAtTime(to,t+length);
  volume.gain.setValueAtTime(.0001,t);volume.gain.exponentialRampToValueAtTime(gain,t+attack);volume.gain.exponentialRampToValueAtTime(.0001,t+length);
  oscillator.connect(volume).connect(c.destination);oscillator.start(t);oscillator.stop(t+length+.03);
 }
 function swish(c,{start=0,length=.12,from=2400,to=500,gain=.09}={}){
  const t=c.currentTime+start,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*length),c.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const source=c.createBufferSource(),filter=c.createBiquadFilter(),volume=c.createGain();
  source.buffer=buffer;filter.type='bandpass';filter.Q.value=1.2;
  filter.frequency.setValueAtTime(from,t);filter.frequency.exponentialRampToValueAtTime(to,t+length);
  volume.gain.setValueAtTime(gain,t);volume.gain.exponentialRampToValueAtTime(.0001,t+length);
  source.connect(filter).connect(volume).connect(c.destination);source.start(t);
 }
 const SOUNDS={
  tap:c=>tone(c,{from:900,to:1250,length:.06,gain:.05}),
  play:c=>{swish(c);tone(c,{type:'triangle',from:230,to:140,length:.12,gain:.07});},
  draw:c=>{swish(c,{from:900,to:2200,length:.09,gain:.05});tone(c,{type:'triangle',from:520,to:780,start:.03,length:.09,gain:.05});},
  turn:c=>{tone(c,{from:1318.5,length:.3,gain:.07});tone(c,{from:1760,start:.12,length:.42,gain:.07});},
  penalty:c=>{tone(c,{type:'square',from:180,to:90,length:.22,gain:.04});tone(c,{type:'square',from:150,to:75,start:.16,length:.26,gain:.04});},
  call:c=>tone(c,{from:620,to:1240,length:.09,gain:.08}),
  win:c=>[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(c,{type:'triangle',from:f,start:i*.11,length:.32,gain:.08})),
  lose:c=>[392,329.63,261.63].forEach((f,i)=>tone(c,{from:f,start:i*.16,length:.34,gain:.06})),
  pop:c=>tone(c,{from:420,to:980,length:.08,gain:.07}),
  shutter:c=>{swish(c,{length:.07,from:5000,to:1800,gain:.08});tone(c,{type:'square',from:1600,to:800,start:.02,length:.035,gain:.03});},
  dice:c=>{swish(c,{length:.32,from:3200,to:900,gain:.05});for(let i=0;i<5;i++)tone(c,{type:'square',from:260+Math.random()*420,start:i*.055,length:.03,gain:.025});},
 };
 return {
  play(name,times=1){
   if(muted||!SOUNDS[name]||navigator.userActivation?.hasBeenActive===false)return;
   const c=audio();if(!c)return;
   for(let i=0;i<Math.min(times,4);i++)setTimeout(()=>SOUNDS[name](c),i*85);
  },
  get muted(){return muted;},
  setMuted(value){muted=!!value;try{localStorage.setItem(KEY,muted?'off':'on');}catch{}if(!muted)audio();},
 };
})();
