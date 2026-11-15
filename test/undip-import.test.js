import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSchedule, diffSchedule } from '../undip-import.js';

// Sample data shaped like SIAP's jadwal / lihat_krs records (field names from the SIAP app), not real student data.
const siapJadwal = JSON.stringify({ status: 'ok', data: [
 { idjadwal: 11, id_trx_pertemuan: 901, hari: 'Senin', kode_mk: 'TKK21301', nama_mk: 'Termodinamika', nama_ruang: 'A.502', sks: '3', tanggal_pertemuan: '2026-11-16', waktu_mulai: '07:00:00', waktu_selesai: '09:30:00', jenis_perkuliahan: 'Kuliah', nim: '0000' },
 { idjadwal: 11, id_trx_pertemuan: 902, hari: 'Senin', kode_mk: 'TKK21301', nama_mk: 'Termodinamika', nama_ruang: 'A.502', sks: '3', tanggal_pertemuan: '2026-11-23', waktu_mulai: '07:00:00', waktu_selesai: '09:30:00', jenis_perkuliahan: 'Kuliah', nim: '0000' },
 { idjadwal: 12, id_trx_pertemuan: 903, hari: 'Rabu', kode_mk: 'TKK21302', nama_mk: 'Perpindahan Panas', nama_ruang: 'B.201', sks: '3', tanggal_pertemuan: '2026-11-18', waktu_mulai: '10:00', waktu_selesai: '12:30', jenis_perkuliahan: 'Kuliah', nim: '0000' },
 { idjadwal: 13, id_trx_pertemuan: 904, hari: 'Jumat', kode_mk: 'TKK21302', nama_mk: 'Perpindahan Panas', nama_ruang: 'Aula', sks: '3', tanggal_pertemuan: '2026-12-04', waktu_mulai: '08:00', waktu_selesai: '10:00', jenis_perkuliahan: 'UAS', nim: '0000' },
]});

const siapKrs = JSON.stringify([
 { id_irs: 1, kode_mk: 'TKK21301', nama_kelas: 'A', nama_mk: 'Termodinamika', sks_mk: '3', ta: '2026', smt_ambil: '5', nama_dosen: 'Dr. Contoh Satu', hari: 'Senin', waktu_mulai: '07:00', waktu_selesai: '09:30', nama_ruang: 'A.502' },
 { id_irs: 2, kode_mk: 'TKK21303', nama_kelas: 'B', nama_mk: 'Operasi Teknik Kimia', sks_mk: '2', nama_dosen: 'Prof. Contoh Dua', hari: 'Kamis', waktu_mulai: '13:00', waktu_selesai: '14:40', nama_ruang: 'C.105' },
]);

test('SIAP jadwal JSON: nested data, one slot per weekly meeting, exams skipped', () => {
 const { items, skipped, format } = parseSchedule(siapJadwal);
 assert.equal(format, 'json');
 assert.equal(items.length, 2);
 assert.deepEqual(items.map(i => [i.day, i.start, i.end, i.course, i.room]), [[1, '07:00', '09:30', 'Termodinamika', 'A.502'], [3, '10:00', '12:30', 'Perpindahan Panas', 'B.201']]);
 assert.equal(skipped.exam, 1);
});

test('SIAP IRS JSON keeps lecturer and class', () => {
 const { items } = parseSchedule(siapKrs);
 assert.equal(items.length, 2);
 assert.equal(items[1].lecturer, 'Prof. Contoh Dua');
 assert.equal(items[1].klass, 'B');
 assert.equal(items[1].day, 4);
});

test('day is taken from the meeting date when hari is missing', () => {
 const { items } = parseSchedule(JSON.stringify([{ nama_mk: 'Statistika', tanggal_pertemuan: '2026-11-19', waktu_mulai: '08:00', waktu_selesai: '09:40' }]));
 assert.equal(items[0].day, 4);
});

test('copied table with header, tab separated', () => {
 const text = 'No\tKode\tMata Kuliah\tKelas\tHari\tJam\tRuang\tDosen\n1\tTKK21301\tTermodinamika\tA\tSenin\t07.00 - 09.30\tA.502\tDr. Contoh Satu\n2\tTKK21304\tKimia Fisika\tA\tSelasa\t13.00 - 15.30\tE.201\tDr. Contoh Tiga';
 const { items, format } = parseSchedule(text);
 assert.equal(format, 'table');
 assert.deepEqual(items.map(i => [i.day, i.start, i.end, i.course, i.room, i.lecturer]), [[1, '07:00', '09:30', 'Termodinamika', 'A.502', 'Dr. Contoh Satu'], [2, '13:00', '15:30', 'Kimia Fisika', 'E.201', 'Dr. Contoh Tiga']]);
});

test('free text: day on each line or as a heading', () => {
 const text = 'Senin 07:00-09:30 Termodinamika | A.502\nRabu\n10.00 – 12.30 TKK21302 Perpindahan Panas · Ruang B.201\nini baris catatan';
 const { items, skipped, format } = parseSchedule(text);
 assert.equal(format, 'text');
 assert.deepEqual(items.map(i => [i.day, i.start, i.course, i.room, i.code]), [[1, '07:00', 'Termodinamika', 'A.502', ''], [3, '10:00', 'Perpindahan Panas', 'B.201', 'TKK21302']]);
 assert.equal(skipped.unreadable, 1);
});

test('a course meeting twice a week gets two stable ids', () => {
 const text = 'Senin 07:00-08:40 Kalkulus\nKamis 07:00-08:40 Kalkulus';
 const ids = parseSchedule(text).items.map(i => i.external_id);
 assert.deepEqual(ids, ['kalkulus#1', 'kalkulus#2']);
});

test('invalid times and empty input are handled', () => {
 assert.equal(parseSchedule('').items.length, 0);
 const { items, skipped } = parseSchedule(JSON.stringify([{ hari: 'Senin', nama_mk: 'X', waktu_mulai: '10:00', waktu_selesai: '09:00' }]));
 assert.equal(items.length, 0);
 assert.equal(skipped.time, 1);
});

test('diff: add, update (moved room/time), remove, unchanged', () => {
 const { items } = parseSchedule(siapKrs);
 const existing = [
  { schedule_id: 5, external_id: items[0].external_id, day: 1, start: '07:00', end: '09:30', course: 'Termodinamika', lecturer: 'Dr. Contoh Satu', room: 'A.501' },
  { schedule_id: 6, external_id: 'lama|#1', day: 2, start: '07:00', end: '08:00', course: 'Lama', lecturer: '', room: '' },
 ];
 const diff = diffSchedule(existing, items);
 assert.equal(diff.add.length, 1);
 assert.equal(diff.update.length, 1);
 assert.deepEqual(diff.update[0].changes, ['room']);
 assert.equal(diff.update[0].before.room, 'A.501');
 assert.deepEqual(diff.remove.map(r => r.schedule_id), [6]);
 assert.equal(diff.same, 0);
});

test('ids survive switching between an IRS table (code, class) and a Gentayu text copy (name only)', () => {
 const table = parseSchedule(['Kode', 'Mata Kuliah', 'Kelas', 'Hari', 'Jam', 'Ruang'].join('\t') + '\n' + ['TKK21301', 'Termodinamika', 'A', 'Senin', '07.00 - 09.30', 'A.502'].join('\t')).items;
 const text = parseSchedule('Senin 07:00-09:30 Termodinamika | C.105').items;
 assert.equal(table[0].external_id, text[0].external_id);
 const existing = [{ schedule_id: 1, ...table[0] }];
 const diff = diffSchedule(existing, text);
 assert.deepEqual([diff.add.length, diff.update.length, diff.remove.length], [0, 1, 0]);
 assert.deepEqual(diff.update[0].changes, ['room']);
});

test('rows saved under an older id are matched by course name and relinked', () => {
 const items = parseSchedule('Senin 07:00-09:30 Termodinamika | A.502').items;
 const existing = [{ schedule_id: 9, external_id: 'tkk21301|a#1', day: 1, start: '07:00', end: '09:30', course: 'Termodinamika', lecturer: '', room: 'A.502' }];
 const diff = diffSchedule(existing, items);
 assert.deepEqual([diff.add.length, diff.update.length, diff.remove.length, diff.same], [0, 0, 0, 1]);
 assert.deepEqual(diff.relink, [{ schedule_id: 9, external_id: 'termodinamika#1' }]);
});

test('copy of the SIAP web "Jadwal Kuliah" table (s/d times, attendance on its own line)', () => {
 // Same shape as selecting the table on siap.undip.ac.id/jadwal_mahasiswa/mhs/jadwal/ and copying it; sample values.
 const copied = '\nNo\tHari\tMatakuliah\tRuangan\tWaktu\tSks\tHadir\tAksi\n'
  + '1\tsenin\tMata Kuliah Satu\tE 1.1 SV TBL\t08:00:00 s/d 08:50:00\t1.0\t\n57.1%\n'
  + '2\tselasa\tMata Kuliah Dua\tE 1.3 SV TBL\t13:00:00 s/d 14:40:00\t2.0\t\n78.6%\n \n'
  + '3\tjumat\tPraktikum Contoh\tLab Contoh SV TBL\t13:00:00 s/d 18:40:00\t2.0\t\n78.6%\n';
 const { items, skipped, format } = parseSchedule(copied);
 assert.equal(format, 'table');
 assert.deepEqual(skipped, {});
 assert.deepEqual(items.map(i => [i.day, i.start, i.end, i.course, i.room]), [
  [1, '08:00', '08:50', 'Mata Kuliah Satu', 'E 1.1 SV TBL'],
  [2, '13:00', '14:40', 'Mata Kuliah Dua', 'E 1.3 SV TBL'],
  [5, '13:00', '18:40', 'Praktikum Contoh', 'Lab Contoh SV TBL'],
 ]);
});
