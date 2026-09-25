import {esc} from './budget-core.js';
const messages={safe:['Yeay, masih aman nyaa! Sisihkan sedikit buat nanti ♡','Satu catatan kecil, satu langkah lebih rapi. Nyaa!','Budget terjaga, hati juga lega~'],near:['Sudah dekat batas, pilih jajan yang paling kamu pengin nyaa.','Pelan-pelan dulu ya. Cek sisa budget sebelum checkout ♡','Nyaa ingetin: sisakan ruang buat kebutuhan besok.'],over:['Budget lewat? Kita atur ulang pelan-pelan, nyaa ♡','Nggak apa-apa, mulai hemat dari transaksi berikutnya.','Yuk cari kencan hemat yang tetap seru nyaa!']};
export function renderNyaa(element,mood='safe',variant=0,hasBudget=true){const eyes=mood==='safe'?'<path d="M45 58q6-9 12 0m26 0q6-9 12 0"/>':mood==='near'?'<path d="m45 49 12 4m26 0 12-4"/><circle cx="51" cy="60" r="3" fill="var(--plum)"/><circle cx="89" cy="60" r="3" fill="var(--plum)"/>':'<path d="m44 54 12 6-12 6m52-12-12 6 12 6"/>';const mouth=mood==='safe'?'M63 68q7 12 14 0':mood==='near'?'M65 73h10':'M63 77q7-10 14 0';element.innerHTML=`<svg viewBox="0 0 140 166" role="img" aria-label="Nyaa, kucing ${mood==='safe'?'senang':mood==='near'?'khawatir':'menyemangati'}"><g stroke="var(--plum)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><!-- Tail behind the body, then two grounded feet. -->
<path d="M99 135C120 137 130 119 120 108C115 103 109 108 113 114C120 125 107 128 99 125" fill="var(--cream)"/>
<path d="M48 83C37 97 38 126 45 141Q70 151 95 141C102 126 103 97 92 83Z" fill="var(--matcha)"/>
<ellipse cx="51" cy="146" rx="16" ry="9" fill="var(--cream)"/>
<ellipse cx="89" cy="146" rx="16" ry="9" fill="var(--cream)"/>
<path d="M47 146v4m7-4v4m31-4v4m7-4v4" stroke-width="2"/>
<!-- A simple savings pouch has one clear silhouette. -->
<path d="M57 101 62 110Q48 120 51 133Q54 143 70 143Q86 143 89 133Q92 120 78 110L83 101Q70 106 57 101Z" fill="var(--pink)"/>
<path d="M62 110h16" fill="none"/>
<circle cx="70" cy="127" r="8" fill="var(--cream)" stroke-width="2"/>
<path d="M67 127h6m-3-3v6" stroke-width="2"/>
<!-- Small cream paws wrap around the pouch, not across the face. -->
<path d="M44 102Q34 110 42 121Q48 128 55 121Q58 116 52 113L50 107" fill="var(--cream)"/>
<path d="M96 102Q106 110 98 121Q92 128 85 121Q82 116 88 113L90 107" fill="var(--cream)"/><path d="M31 54 28 18 54 35Q70 29 86 35L112 18 109 55Q119 86 70 91 21 86 31 54Z" fill="var(--cream)"/><path d="m35 30 3 18 10-9m57-9-3 18-10-9" fill="var(--pink)" stroke="none"/><g fill="none">${eyes}<path d="${mouth}"/></g><ellipse cx="39" cy="70" rx="7" ry="4" fill="var(--pink)" stroke="none"/><ellipse cx="101" cy="70" rx="7" ry="4" fill="var(--pink)" stroke="none"/><path d="m32 66-13-3m13 11-13 3m89-11 13-3m-13 11 13 3"/></g></svg><p>${esc(hasBudget?messages[mood][variant%3]:['Halo, aku Nyaa! Atur budget dulu, nanti kita pantau bareng ♡','Satu catatan kecil dulu yuk, nyaa~','Rencana hemat dimulai dari sini. Kita catat bareng ♡'][variant%3])}</p>`;}
