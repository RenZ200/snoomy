// Preserve links shared before Budgeting became its own page.
if(location.hash==='#budgeting')location.replace('/budgeting.html');
window.addEventListener('hashchange',()=>{if(location.hash==='#budgeting')location.replace('/budgeting.html');});
