// Installable app: offline shell plus an install button (Android prompt, iPhone instructions).
(() => {
 if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
 const button=document.querySelector('#install-app'),help=document.querySelector('#install-help');
 if(!button||!help)return;
 const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const iPhone=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 let prompt;
 button.hidden=installed()||!iPhone;
 addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;button.hidden=installed();});
 addEventListener('appinstalled',()=>{prompt=null;button.hidden=true;});
 button.addEventListener('click',async()=>{
  if(!prompt)return help.showModal();
  prompt.prompt();
  const {outcome}=await prompt.userChoice;
  prompt=null;
  if(outcome==='accepted')button.hidden=true;
 });
 help.querySelectorAll('[data-install-close]').forEach(close=>close.addEventListener('click',()=>help.close()));
})();
