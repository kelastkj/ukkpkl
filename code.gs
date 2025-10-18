/** =====================================================
 *  SISTEM INFORMASI PKL & UKK INDUSTRI
 *  Dataset:
 *   - UKK        : mitra | kompetensi
 *   - PESERTA    : mitra | siswa | kelas
 *   - PEMBIMBING : no | pembimbing | siswa | kelas | mitra
 *   - PENGUJI    : no | penguji | siswa | kelas | mitra   (BARU)
 *  ===================================================== */

const SHEET_UKK        = 'UKK';
const SHEET_PESERTA    = 'PESERTA';
const SHEET_PEMBIMBING = 'PEMBIMBING';
const SHEET_PENGUJI    = 'PENGUJI'; // BARU

/* ---------- Utilities ---------- */
const _norm  = v => (v == null ? '' : String(v)).trim();
const _json  = o => ContentService.createTextOutput(JSON.stringify(o))
                    .setMimeType(ContentService.MimeType.JSON);
const _now   = () => new Date().toISOString();
const _sheet = name => SpreadsheetApp.getActive().getSheetByName(name);

function _readRowsGeneric(sheetName) {
  const sh = _sheet(sheetName);
  if (!sh) throw new Error('Sheet tidak ditemukan: ' + sheetName);
  const values = sh.getDataRange().getValues();
  if (!values.length) return { header: [], rows: [] };

  const header = values[0].map(h => _norm(h).toLowerCase());
  const rows   = [];
  for (let r = 1; r < values.length; r++) {
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = _norm(values[r][c]);
    rows.push(obj);
  }
  return { header, rows };
}

/* =====================================================
 *  ===========  DATASET: UKK  ==========================
 *  Skema: mitra | kompetensi (baris ke bawah)
 * ===================================================== */
function ukk_meta() {
  const { header, rows } = _readRowsGeneric(SHEET_UKK);
  const need = ['mitra', 'kompetensi'];
  const miss = need.filter(k => !header.includes(k));
  if (miss.length) throw new Error('Header UKK wajib: ' + miss.join(', '));

  const mitraSet = new Set();
  rows.forEach(r => { if (r.mitra) mitraSet.add(r.mitra); });

  return {
    ok: true,
    route: 'meta',
    updatedAt: _now(),
    meta: { mitra: Array.from(mitraSet).sort() }
  };
}

function ukk_data(params) {
  const { header, rows } = _readRowsGeneric(SHEET_UKK);
  const need = ['mitra', 'kompetensi'];
  const miss = need.filter(k => !header.includes(k));
  if (miss.length) throw new Error('Header UKK wajib: ' + miss.join(', '));

  const mitra = _norm(params.mitra);
  const q     = _norm(params.q).toLowerCase();

  let out = rows;
  if (mitra) out = out.filter(r => r.mitra === mitra);
  if (q) out = out.filter(r =>
      (r.kompetensi || '').toLowerCase().includes(q) ||
      (r.mitra || '').toLowerCase().includes(q)
  );

  const data = out.map(r => ({ mitra: r.mitra, kompetensi: r.kompetensi }));
  return { ok: true, route: 'data', updatedAt: _now(), count: data.length, data };
}

/* =====================================================
 *  ===========  DATASET: PESERTA  ======================
 *  Skema: mitra | siswa | kelas
 * ===================================================== */
function peserta_meta() {
  const { header, rows } = _readRowsGeneric(SHEET_PESERTA);
  const need = ['mitra', 'siswa', 'kelas'];
  const miss = need.filter(k => !header.includes(k));
  if (miss.length) throw new Error('Header PESERTA wajib: ' + miss.join(', '));

  const mitraSet = new Set();
  rows.forEach(r => { if (r.mitra) mitraSet.add(r.mitra); });

  return { ok: true, route: 'meta', updatedAt: _now(), meta: { mitra: Array.from(mitraSet).sort() } };
}

function peserta_by_mitra(mitra) {
  const { header, rows } = _readRowsGeneric(SHEET_PESERTA);
  const data = rows.filter(r => r.mitra === mitra)
                   .map(r => ({ mitra: r.mitra, siswa: r.siswa, kelas: r.kelas }));
  return { ok: true, route: 'data', updatedAt: _now(), count: data.length, data };
}

function peserta_search(q) {
  const { header, rows } = _readRowsGeneric(SHEET_PESERTA);
  const qq = _norm(q).toLowerCase();
  const data = rows.filter(r => (r.siswa || '').toLowerCase().includes(qq))
                   .map(r => ({ mitra: r.mitra, siswa: r.siswa, kelas: r.kelas }));
  return { ok: true, route: 'search', updatedAt: _now(), count: data.length, data };
}

/* =====================================================
 *  ===========  DATASET: PEMBIMBING  ===================
 *  Skema: no | pembimbing | siswa | kelas | mitra
 * ===================================================== */
function pembimbing_meta(){
  const { header, rows } = _readRowsGeneric(SHEET_PEMBIMBING);
  const need = ['pembimbing','siswa','kelas','mitra'];
  const miss = need.filter(k=>!header.includes(k));
  if(miss.length) throw new Error('Header PEMBIMBING wajib: '+miss.join(', '));

  const set = new Set();
  rows.forEach(r => { if(r.pembimbing) set.add(r.pembimbing); });

  return { ok:true, route:'meta', updatedAt:_now(), meta:{ pembimbing: Array.from(set).sort() } };
}

function pembimbing_by_nama(nama){
  const { header, rows } = _readRowsGeneric(SHEET_PEMBIMBING);
  const data = rows.filter(r => r.pembimbing === nama)
                   .map(r => ({ pembimbing:r.pembimbing, siswa:r.siswa, kelas:r.kelas, mitra:r.mitra }));
  return { ok:true, route:'data', updatedAt:_now(), count:data.length, data };
}

function pembimbing_search(q){
  const { header, rows } = _readRowsGeneric(SHEET_PEMBIMBING);
  const qq = (q||'').toLowerCase();
  const data = rows.filter(r => (r.siswa||'').toLowerCase().includes(qq))
                   .map(r => ({ pembimbing:r.pembimbing, siswa:r.siswa, kelas:r.kelas, mitra:r.mitra }));
  return { ok:true, route:'search', updatedAt:_now(), count:data.length, data };
}

/* =====================================================
 *  ===========  DATASET: PENGUJI  (BARU) ===============
 *  Skema: no | penguji | siswa | kelas | mitra
 * ===================================================== */
function penguji_meta(){
  const { header, rows } = _readRowsGeneric(SHEET_PENGUJI);
  const need = ['penguji','siswa','kelas','mitra'];
  const miss = need.filter(k=>!header.includes(k));
  if(miss.length) throw new Error('Header PENGUJI wajib: '+miss.join(', '));

  const set = new Set();
  rows.forEach(r => { if(r.penguji) set.add(r.penguji); });

  return { ok:true, route:'meta', updatedAt:_now(), meta:{ penguji: Array.from(set).sort() } };
}

function penguji_by_nama(nama){
  const { header, rows } = _readRowsGeneric(SHEET_PENGUJI);
  const data = rows.filter(r => r.penguji === nama)
                   .map(r => ({ penguji:r.penguji, siswa:r.siswa, kelas:r.kelas, mitra:r.mitra }));
  return { ok:true, route:'data', updatedAt:_now(), count:data.length, data };
}

function penguji_search(q){
  const { header, rows } = _readRowsGeneric(SHEET_PENGUJI);
  const qq = (q||'').toLowerCase();
  const data = rows.filter(r => (r.siswa||'').toLowerCase().includes(qq))
                   .map(r => ({ penguji:r.penguji, siswa:r.siswa, kelas:r.kelas, mitra:r.mitra }));
  return { ok:true, route:'search', updatedAt:_now(), count:data.length, data };
}

/* =====================================================
 *  ===========  ROUTER  ================================
 * ===================================================== */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const dataset = (p.dataset || '').toLowerCase();

    // PENGUJI (BARU)
    if(dataset === 'penguji'){
      if(p.route === 'meta') return _json(penguji_meta());
      if(p.q)                return _json(penguji_search(p.q));
      if(p.penguji)          return _json(penguji_by_nama(p.penguji));
      return _json({ok:false,error:'Parameter kurang untuk dataset=penguji. Gunakan route=meta, q=, atau penguji='});
    }

    // PEMBIMBING
    if(dataset === 'pembimbing'){
      if(p.route === 'meta')      return _json(pembimbing_meta());
      if(p.q)                     return _json(pembimbing_search(p.q));
      if(p.pembimbing)            return _json(pembimbing_by_nama(p.pembimbing));
      return _json({ok:false,error:'Parameter kurang untuk dataset=pembimbing. Gunakan route=meta, q=, atau pembimbing='});
    }

    // PESERTA
    if(dataset === 'peserta'){
      if(p.route === 'meta') return _json(peserta_meta());
      if(p.q)                return _json(peserta_search(p.q));
      if(p.mitra)            return _json(peserta_by_mitra(p.mitra));
      return _json({ok:false,error:'Parameter kurang untuk dataset=peserta.'});
    }

    // Default: UKK (kompatibel dengan pola lama)
    if(p.route === 'meta') return _json(ukk_meta());
    return _json(ukk_data(p));

  } catch(err) {
    return _json({ ok:false, error: err.message });
  }
}
