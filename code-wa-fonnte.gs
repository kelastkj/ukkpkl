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
// New sheets for auth and uploads
const SHEET_USERS      = 'USERS';
const SHEET_UPLOADS    = 'UPLOADS';
const SHEET_NILAI      = 'NILAI-PRESENTASI';

// Drive folders (replace with your own IDs in deployment)
const FOLDER_PKL_ID    = '1RZIHlwgAeWKlxTxt-KZ_OjC2cJBjq2dS';
const FOLDER_UKK_ID    = '1ap51yBOZ7qIbHJ6AzCbDhWqmORd-viXY';

// --- Fonte (WhatsApp provider) default config ---
// You can replace these values here, or set Script Properties
// FONTE_API_URL and FONTE_API_TOKEN to override at runtime.
const FONTE_API_URL_DEFAULT   = 'REPLACE_WITH_FONTE_API_URL';
const FONTE_API_TOKEN_DEFAULT = 'REPLACE_WITH_FONTE_API_TOKEN';
// Header name and prefix (some providers expect e.g. 'Authorization: Bearer <token>' while others want 'x-api-key: <token>')
const FONTE_API_HEADER_NAME_DEFAULT   = 'Authorization';
// Default prefix empty because Fonte example uses 'Authorization: TOKEN' (no Bearer)
const FONTE_API_TOKEN_PREFIX_DEFAULT  = '';
// Payload field names (adjust if Fonte expects different keys)
// Fonte PHP example uses keys: target (phone) and message
const FONTE_PAYLOAD_PHONE_FIELD_DEFAULT   = 'target';
const FONTE_PAYLOAD_MESSAGE_FIELD_DEFAULT = 'message';

/* ---------- Utilities ---------- */
const _norm  = v => (v == null ? '' : String(v)).trim();
const _json  = o => ContentService.createTextOutput(JSON.stringify(o))
                    .setMimeType(ContentService.MimeType.JSON);
const _now   = () => new Date().toISOString();
const _sheet = name => SpreadsheetApp.getActive().getSheetByName(name);
const _prop  = () => PropertiesService.getScriptProperties();

function _hashSHA256(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return Utilities.base64Encode(bytes);
}

function _jsonp(obj, cb) {
  const body = cb ? `${cb}(${JSON.stringify(obj)})` : JSON.stringify(obj);
  return ContentService.createTextOutput(body)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function _users_readAll() {
  const { header, rows } = _readRowsGeneric(SHEET_USERS);
  const need = ['username','password_hash','role'];
  const miss = need.filter(k => !header.includes(k));
  if (miss.length) throw new Error('Header USERS wajib: ' + miss.join(', '));
  return rows;
}

function _auth_login(username, password) {
  const u = _norm(username);
  const p = _norm(password);
  if (!u || !p) return { ok:false, error:'Username/password wajib' };
  const users = _users_readAll();
  const found = users.find(x => (x.username||'') === u);
  if (!found) return { ok:false, error:'Pengguna tidak ditemukan' };
  const hash = _hashSHA256(p);
  if ((found.password_hash||'') !== hash) return { ok:false, error:'Password salah' };
  const token = Utilities.base64EncodeWebSafe(Utilities.getUuid());
  const profile = {
    username: found.username,
    role: (found.role||'').toLowerCase(),
    nama: found.nama || '',
    kelas: found.kelas || '',
    mitra: found.mitra || ''
  };
  const sess = { token, profile, exp: Date.now() + (24*60*60*1000) };
  _prop().setProperty('sess_'+token, JSON.stringify(sess));
  return { ok:true, token, profile };
}

function _auth_check(token) {
  const raw = _prop().getProperty('sess_'+_norm(token));
  if (!raw) return null;
  try {
    const sess = JSON.parse(raw);
    if (Date.now() > (sess.exp||0)) {
      _prop().deleteProperty('sess_'+sess.token);
      return null;
    }
    return sess;
  } catch(e){ return null; }
}

function _log_upload(row) {
  const sh = _sheet(SHEET_UPLOADS) || SpreadsheetApp.getActive().insertSheet(SHEET_UPLOADS);
  const header = ['timestamp','username','role','category','fileId','fileName','mimeType','size','mitra','nama','kelas'];
  if (sh.getLastRow() === 0) sh.appendRow(header);
  const rec = header.map(k => row[k] || '');
  sh.appendRow(rec);
}

/* ---------- WhatsApp (Fonte) notification helpers ---------- */
function _normalizePhone(p) {
  if (!p) return '';
  // keep leading + if present, remove other non-digits
  const s = String(p || '').trim();
  const plus = s.charAt(0) === '+' ? '+' : '';
  const digits = s.replace(/[^0-9]/g, '');
  return (plus + digits).replace(/^\+0+/, '+');
}

// Lookup phone(s) for a given penguji name via USERS or PENGUJI sheet (supports column 'phone' or 'wa')
function _lookupPhonesForNames(names) {
  if (!names || !names.length) return [];
  const phones = new Set();
  try {
    // Check USERS first (preferred place to store contact)
    const users = _users_readAll();
    users.forEach(u => {
      const nama = (u.nama || '').toString();
      const username = (u.username || '').toString();
      const ph = (u.phone || u.wa || u.whatsapp || '') || '';
      if (!ph) return;
      if (names.includes(nama) || names.includes(username)) phones.add(_normalizePhone(ph));
    });
  } catch (e) { /* ignore */ }

  try {
    // Also check PENGUJI sheet for an explicit phone column if present
    const pj = _readRowsGeneric(SHEET_PENGUJI).rows;
    pj.forEach(r => {
      const pg = (r.penguji || '').toString();
      const ph = (r.phone || r.wa || r.whatsapp || '') || '';
      if (ph && names.includes(pg)) phones.add(_normalizePhone(ph));
    });
  } catch (e) { /* ignore */ }

  // return cleaned list
  return Array.from(phones).filter(x => x);
}

// Return array of { name, phone } for given penguji names (preserve which phone belongs to which name)
function _lookupPhoneMapForNames(names){
  if(!names || !names.length) return [];
  const results = [];
  try{
    const users = _users_readAll();
    names.forEach(n => {
      const found = users.find(u => (u.nama||'') === n || (u.username||'') === n);
      const ph = found ? (found.phone || found.wa || found.whatsapp || '') : '';
      if(ph) results.push({ name: n, phone: _normalizePhone(ph) });
    });
  }catch(e){}
  try{
    const pj = _readRowsGeneric(SHEET_PENGUJI).rows;
    names.forEach(n => {
      const row = pj.find(r => (r.penguji||'') === n && (r.phone || r.wa || r.whatsapp));
      if(row){
        const ph = row.phone || row.wa || row.whatsapp || '';
        if(ph) results.push({ name: n, phone: _normalizePhone(ph) });
      }
    });
  }catch(e){}
  // De-duplicate by phone
  const seen = new Set();
  return results.filter(r => { if(seen.has(r.phone)) return false; seen.add(r.phone); return true; });
}

// Find penguji names for a given student by scanning PENGUJI sheet
function _getPengujiNamesForStudent(studentName) {
  if (!studentName) return [];
  try {
    const rows = _readRowsGeneric(SHEET_PENGUJI).rows;
    const names = rows.filter(r => (r.siswa || '') === studentName).map(r => r.penguji).filter(Boolean);
    return Array.from(new Set(names));
  } catch (e) { return []; }
}

// Send WhatsApp message via Fonte -- expects Script Properties: FONTE_API_URL and FONTE_API_TOKEN
function _sendWhatsAppViaFonte(to, message) {
  if (!to || !message) return false;
  const props = _prop();
  // Prefer Script Properties (safe for deployment). Fall back to defaults in file.
  const url = props.getProperty('FONTE_API_URL') || props.getProperty('fonte_url') || FONTE_API_URL_DEFAULT;
  const token = props.getProperty('FONTE_API_TOKEN') || props.getProperty('fonte_token') || props.getProperty('FONTE_TOKEN') || FONTE_API_TOKEN_DEFAULT;
  const headerName = props.getProperty('FONTE_API_HEADER_NAME') || props.getProperty('fonte_header_name') || FONTE_API_HEADER_NAME_DEFAULT;
  const tokenPrefix = props.getProperty('FONTE_API_TOKEN_PREFIX') || props.getProperty('fonte_token_prefix') || FONTE_API_TOKEN_PREFIX_DEFAULT;
  const phoneField = props.getProperty('FONTE_PAYLOAD_PHONE_FIELD') || FONTE_PAYLOAD_PHONE_FIELD_DEFAULT;
  const messageField = props.getProperty('FONTE_PAYLOAD_MESSAGE_FIELD') || FONTE_PAYLOAD_MESSAGE_FIELD_DEFAULT;
  if (!url || !token) {
    Logger.log('Fonte config missing (FONTE_API_URL / FONTE_API_TOKEN)');
    // log to sheet for persistent debugging
    try{ _log_notification({ timestamp: new Date(), to: to, message: message, status: 'config_missing', httpCode: '', responseBody: '', note: 'Fonte config missing' }); }catch(e){}
    return false;
  }
  try {
    // Build payload according to configurable field names
    // Build form payload (match PHP cURL example: multipart/form-data or form fields)
    const payload = {};
    payload[phoneField] = to;
    payload[messageField] = message;
    // Additional optional fields could be added via Script Properties if needed (e.g. countryCode)
    const headers = {};
    headers[headerName] = (tokenPrefix || '') + token;
    const opts = {
      method: 'post',
      // Do NOT set contentType so UrlFetchApp will send form-encoded or multipart when blobs present
      headers: headers,
      payload: payload,
      muteHttpExceptions: true
    };
    // Log what we will send (without token) for debugging
    try{ _log_notification({ timestamp: new Date(), to: to, message: message, status: 'trying', httpCode: '', responseBody: '', note: 'sending via ' + url + ' header=' + headerName + ' prefix=' + (tokenPrefix?tokenPrefix.trim():'') + ' payloadFields=' + phoneField + ',' + messageField }); }catch(e){}
    const resp = UrlFetchApp.fetch(url, opts);
    const code = resp.getResponseCode();
    const body = resp.getContentText();
    Logger.log('Fonte response: ' + code + ' - ' + body);
    try{ _log_notification({ timestamp: new Date(), to: to, message: message, status: code >=200 && code <300 ? 'sent' : 'failed', httpCode: code, responseBody: body, note: '' }); }catch(e){}
    return code >= 200 && code < 300;
  } catch (e) {
    Logger.log('Error sending WA: ' + e.message);
    try{ _log_notification({ timestamp: new Date(), to: to, message: message, status: 'error', httpCode: '', responseBody: e.message, note: '' }); }catch(err){}
    return false;
  }
}

function _notify_penguji_on_upload(row) {
  try {
    const student = row.nama || row.username || '';
    if (!student) return false;
    // find penguji names for this student
    const pengujiNames = _getPengujiNamesForStudent(student);
    if (!pengujiNames.length) {
      try{ _log_notification({ timestamp: new Date(), to: '', message: '', status: 'no_penguji', httpCode: '', responseBody: '', student: student, penguji: '', phones: '', note: 'no penguji found for student' }); }catch(e){}
      return false;
    }
    const phoneMap = _lookupPhoneMapForNames(pengujiNames);
    if (!phoneMap.length) {
      try{ _log_notification({ timestamp: new Date(), to: '', message: '', status: 'no_phones', httpCode: '', responseBody: '', student: student, penguji: JSON.stringify(pengujiNames), phones: '', note: 'no phones found for penguji names' }); }catch(e){}
      return false;
    }
    const kind = (row.category || '').toLowerCase() === 'pkl' ? 'Laporan PKL' : ((row.category || '').toLowerCase() === 'ukk' ? 'dokumentasi UKK' : 'dokumen');
    const filePart = row.fileName ? (" dengan file: " + row.fileName) : '';
    phoneMap.forEach(entry => {
      const pengujiName = entry.name || '';
      const ph = entry.phone;
      const driveLink = row.fileId ? ('https://drive.google.com/file/d/' + row.fileId + '/view') : 'https://pkl.kelastkj.online/';
      const portalLink = 'https://pkl.kelastkj.online/';
      const personalised = `Yth. Bapak/Ibu ${pengujiName},\n\nInformasi: siswa *${student}* telah mengunggah ${kind}${filePart}.\n\n1) Untuk melihat berkas langsung: ${driveLink}\n2) Untuk memberi penilaian: buka ${portalLink} -> login -> pilih menu "Pengujian" -> cari nama siswa dan masukkan nilai.\n\nJika Bapak/Ibu menemukan kendala akses pada file, mohon konfirmasi balas pesan ini agar kami bantu.\n\nTerima kasih atas waktu dan perhatiannya.`;
      try { _sendWhatsAppViaFonte(ph, personalised); } catch (e) { Logger.log('Notify error for ' + ph + ': ' + e.message); try{ _log_notification({ timestamp: new Date(), to: ph, message: personalised, status: 'error', httpCode: '', responseBody: e.message, student: student, penguji: pengujiName, phones: JSON.stringify(phoneMap), note: 'exception in foreach' }); }catch(ex){} }
    });
    return true;
  } catch (e) { Logger.log('notify_penguji_on_upload error: ' + e.message); return false; }
}

// Log notification attempts/results to sheet NOTIFICATIONS for persistent debugging
function _log_notification(obj){
  const shName = 'NOTIFICATIONS';
  const sh = _sheet(shName) || SpreadsheetApp.getActive().insertSheet(shName);
  const header = ['timestamp','to','message','status','httpCode','responseBody','student','penguji','phones','note'];
  if(sh.getLastRow() === 0) sh.appendRow(header);
  const values = header.map(h => obj[h] || '');
  sh.appendRow(values);
}

// Debug helper: write current Fonte config (except full token) to NOTIFICATIONS
function _showFonteConfig(){
  const props = _prop();
  const url = props.getProperty('FONTE_API_URL') || props.getProperty('fonte_url') || FONTE_API_URL_DEFAULT;
  const token = props.getProperty('FONTE_API_TOKEN') || props.getProperty('fonte_token') || props.getProperty('FONTE_TOKEN') || FONTE_API_TOKEN_DEFAULT;
  const headerName = props.getProperty('FONTE_API_HEADER_NAME') || props.getProperty('fonte_header_name') || FONTE_API_HEADER_NAME_DEFAULT;
  const tokenPrefix = props.getProperty('FONTE_API_TOKEN_PREFIX') || props.getProperty('fonte_token_prefix') || FONTE_API_TOKEN_PREFIX_DEFAULT;
  const phoneField = props.getProperty('FONTE_PAYLOAD_PHONE_FIELD') || FONTE_PAYLOAD_PHONE_FIELD_DEFAULT;
  const messageField = props.getProperty('FONTE_PAYLOAD_MESSAGE_FIELD') || FONTE_PAYLOAD_MESSAGE_FIELD_DEFAULT;
  const masked = token ? ('' + token).slice(0,4) + '...' : '';
  _log_notification({ timestamp: new Date(), to: '', message: '', status: 'config_dump', httpCode: '', responseBody: '', note: JSON.stringify({ url:url, headerName: headerName, tokenPrefix: tokenPrefix, tokenMasked: masked, phoneField: phoneField, messageField: messageField }) });
  Logger.log('Fonte config: url=%s header=%s prefix=%s tokenMasked=%s phoneField=%s messageField=%s', url, headerName, tokenPrefix, masked, phoneField, messageField);
}

function _readUploads(){
  const sh = _sheet(SHEET_UPLOADS);
  if(!sh || sh.getLastRow() === 0) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0].map(h=>_norm(h));
  const idx = {}; header.forEach((h,i)=> idx[h]=i);
  const rows = [];
  for(let r=1;r<values.length;r++){
    const v = values[r];
    rows.push({
      timestamp: v[idx['timestamp']], username: v[idx['username']], role: v[idx['role']],
      category: v[idx['category']], fileId: v[idx['fileId']], fileName: v[idx['fileName']], mimeType: v[idx['mimeType']], size: v[idx['size']],
      mitra: v[idx['mitra']], nama: v[idx['nama']], kelas: v[idx['kelas']]
    });
  }
  return rows;
}

function _mapGuruToStudents(){
  // Kumpulkan mapping pembimbing dan penguji → daftar siswa
  const map = { pembimbing:{}, penguji:{} };
  const pb = _readRowsGeneric(SHEET_PEMBIMBING).rows;
  pb.forEach(r=>{
    const key = r.pembimbing || '';
    if(!key) return;
    if(!map.pembimbing[key]) map.pembimbing[key] = [];
    map.pembimbing[key].push({ nama:r.siswa, kelas:r.kelas, mitra:r.mitra });
  });
  const pj = _readRowsGeneric(SHEET_PENGUJI).rows;
  pj.forEach(r=>{
    const key = r.penguji || '';
    if(!key) return;
    if(!map.penguji[key]) map.penguji[key] = [];
    map.penguji[key].push({ nama:r.siswa, kelas:r.kelas, mitra:r.mitra });
  });
  return map;
}

function _deleteUploadRowByFileId(fileId){
  const sh = _sheet(SHEET_UPLOADS);
  if(!sh) return false;
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return false;
  const header = values[0].map(h=>_norm(h));
  const idx = header.indexOf('fileId');
  const idx2 = idx >= 0 ? idx : header.findIndex(h=>h.toLowerCase()==='fileid');
  const col = (idx2 >= 0 ? idx2 : -1) + 1; // 1-based
  if(col <= 0) return false;
  for(let r=2; r<=values.length; r++){
    const v = values[r-1][col-1];
    if(String(v) === String(fileId)){
      sh.deleteRow(r);
      return true;
    }
  }
  return false;
}

function _canDelete(sess, row){
  // siswa: hanya boleh hapus miliknya
  if(sess.profile.username === row.username) return true;
  // guru: boleh hapus siswa yang dibimbing/diuji
  if((sess.profile.role||'') === 'guru'){
    const map = _mapGuruToStudents();
    const nameGuru = sess.profile.nama || sess.profile.username;
    const list = new Set();
    (map.pembimbing[nameGuru]||[]).forEach(s => list.add(s.nama));
    (map.penguji[nameGuru]||[]).forEach(s => list.add(s.nama));
    return list.has(row.nama);
  }
  return false;
}

function _handle_upload_(params) {
  // Validate session
  const token = _norm(params.token);
  const sess = _auth_check(token);
  const redirect = _norm(params.redirect) || '';
  function _redirectPage(msg, ok) {
    const url = redirect ? (redirect + (redirect.indexOf('?')>-1?'&':'?') + (ok? 'status=ok':'status=err') + '&msg=' + encodeURIComponent(msg)) : '';
    const html = `<!doctype html><meta charset="utf-8"><title>Upload ${ok?'Berhasil':'Gagal'}</title>`+
      (redirect ? `<meta http-equiv="refresh" content="0;url=${url}">` : '')+
      `<body style="font-family:system-ui,Arial; padding:20px">
        ${ok?'✅':'❌'} ${msg}${redirect?'<div>Redirecting...</div>':''}
        <script>(function(){
          try{parent&&parent.postMessage&&parent.postMessage({type:'upload', ok:${ok?'true':'false'}, message:${JSON.stringify(msg)}}, '*');}catch(e){}
          try{window.opener&&window.opener.postMessage&&window.opener.postMessage({type:'upload', ok:${ok?'true':'false'}, message:${JSON.stringify(msg)}}, '*');}catch(e){}
          try{setTimeout(function(){ window.close && window.close(); }, 500);}catch(e){}
        })();</script>
      </body>`;
    const out = HtmlService.createHtmlOutput(html);
    // Izinkan ditampilkan dalam iframe agar tidak perlu popup di dashboard
    out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return out;
  }
  if (!sess) return _redirectPage('Sesi tidak valid. Silakan login ulang.', false);

  const category = (_norm(params.category)||'').toLowerCase(); // pkl | ukk
  const origName = _norm(params.file_name) || 'upload.bin';
  const mimeType = _norm(params.mime_type) || 'application/octet-stream';
  const b64 = params.file_b64 || '';
  if (!b64) return _redirectPage('Data file kosong.', false);

  // Tentukan nama file Drive berdasarkan nama siswa + kategori, tanpa nama asli file
  function _sanitizeName(s){ return (s||'').replace(/[^\w\-\.\s]/g,' ').replace(/\s+/g,' ').trim(); }
  const studentName = _sanitizeName(sess.profile.nama || sess.profile.username || 'Siswa');
  const extMatch = origName.match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extMatch ? extMatch[0] : '';
  const suffix = (category === 'pkl') ? ' - PKL' : (category === 'ukk' ? ' - UKK' : '');
  const driveName = _sanitizeName(`${studentName}${suffix}`) + ext;

  const bytes = Utilities.base64Decode(b64);
  const blob  = Utilities.newBlob(bytes, mimeType, driveName);
  const folderId = category === 'pkl' ? FOLDER_PKL_ID : (category === 'ukk' ? FOLDER_UKK_ID : '');
  if (!folderId || folderId.indexOf('REPLACE_') === 0) return _redirectPage('Folder Drive belum dikonfigurasi.', false);
  try {
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);
    const uploadRec = {
      timestamp: new Date(),
      username: sess.profile.username,
      role: sess.profile.role,
      category,
      fileId: file.getId(),
      fileName: file.getName(),
      mimeType,
      size: bytes.length,
      mitra: sess.profile.mitra,
      nama: sess.profile.nama,
      kelas: sess.profile.kelas
    };
    _log_upload(uploadRec);
    try { _notify_penguji_on_upload(uploadRec); } catch(e){ Logger.log('Notify error: ' + (e && e.message)); }
    return _redirectPage('Upload berhasil.', true);
  } catch(err) {
    return _redirectPage('Gagal menyimpan ke Drive: '+err.message, false);
  }
}

function _handle_delete_(params){
  const token = _norm(params.token);
  const sess = _auth_check(token);
  const fileId = _norm(params.fileId || params.file_id);
  const redirect = _norm(params.redirect) || '';
  function _redirectPage(msg, ok){
    const url = redirect ? (redirect + (redirect.indexOf('?')>-1?'&':'?') + (ok? 'status=ok':'status=err') + '&msg=' + encodeURIComponent(msg)) : '';
    const html = `<!doctype html><meta charset="utf-8"><title>Hapus ${ok?'Berhasil':'Gagal'}</title>`+
      (redirect ? `<meta http-equiv="refresh" content="0;url=${url}">` : '')+
      `<body style="font-family:system-ui,Arial; padding:20px">${ok?'✅':'❌'} ${msg}
        <script>(function(){
          try{parent&&parent.postMessage&&parent.postMessage({type:'delete', ok:${ok?'true':'false'}, fileId:${JSON.stringify(fileId)}, message:${JSON.stringify(msg)}}, '*');}catch(e){}
          try{window.opener&&window.opener.postMessage&&window.opener.postMessage({type:'delete', ok:${ok?'true':'false'}, fileId:${JSON.stringify(fileId)}, message:${JSON.stringify(msg)}}, '*');}catch(e){}
          try{setTimeout(function(){ window.close && window.close(); }, 500);}catch(e){}
        })();</script>
      </body>`;
    const out = HtmlService.createHtmlOutput(html);
    out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    return out;
  }
  if(!sess) return _redirectPage('Sesi tidak valid.', false);
  if(!fileId) return _redirectPage('Parameter fileId kosong.', false);
  // Cari row upload
  const rows = _readUploads();
  const row = rows.find(r => String(r.fileId) === fileId);
  if(!row) return _redirectPage('Data upload tidak ditemukan.', false);
  if(!_canDelete(sess, row)) return _redirectPage('Tidak memiliki izin untuk menghapus file ini.', false);
  try{
    // Hapus file di Drive (ke trash)
    try{ DriveApp.getFileById(fileId).setTrashed(true); }catch(e){ /* jika sudah terhapus, lanjut */ }
    // Hapus baris di sheet
    const ok = _deleteUploadRowByFileId(fileId);
    if(!ok) return _redirectPage('Gagal menghapus data pada sheet.', false);
    return _redirectPage('File dan data berhasil dihapus.', true);
  }catch(err){
    return _redirectPage('Gagal menghapus: '+err.message, false);
  }
}

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
 * NILAI PRESENTASI - penyimpanan dan pembacaan
 * Skema (header): nama | struktur | penyampaian | penguasaan | media | sikap | total | timestamp
 * ===================================================== */
function _readNilaiPresentasi(){
  const sh = _sheet(SHEET_NILAI);
  if(!sh || sh.getLastRow() === 0) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0].map(h => _norm(h).toLowerCase());
  const idx = {}; header.forEach((h,i)=> idx[h]=i);
  const rows = [];
  for(let r=1;r<values.length;r++){
    const v = values[r];
    rows.push({
      username: v[idx['username']]||'', nama: v[idx['nama']]||'', struktur: v[idx['struktur']]||'', penyampaian: v[idx['penyampaian']]||'',
      penguasaan: v[idx['penguasaan']]||'', media: v[idx['media']]||'', sikap: v[idx['sikap']]||'',
      total: v[idx['total']]||'', timestamp: v[idx['timestamp']]||''
    });
  }
  return rows;
}

function _readNilaiPKL(){
  const sh = _sheet('NILAI-PKL');
  if(!sh || sh.getLastRow() === 0) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0].map(h => _norm(h).toLowerCase());
  const idx = {}; header.forEach((h,i)=> idx[h]=i);
  const rows = [];
  for(let r=1;r<values.length;r++){
    const v = values[r];
    rows.push({ username: v[idx['username']]||'', nama: v[idx['nama']]||'', total: v[idx['total']]||'', timestamp: v[idx['timestamp']]||'' });
  }
  return rows;
}

function _readNilaiUKK(){
  const sh = _sheet('NILAI-UKK');
  if(!sh || sh.getLastRow() === 0) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0].map(h => _norm(h).toLowerCase());
  const idx = {}; header.forEach((h,i)=> idx[h]=i);
  const rows = [];
  for(let r=1;r<values.length;r++){
    const v = values[r];
    rows.push({ username: v[idx['username']]||'', nama: v[idx['nama']]||'', keterangan: v[idx['keterangan']]||'', timestamp: v[idx['timestamp']]||'' });
  }
  return rows;
}

function _save_nilai_presentasi(params){
  const username = _norm(params.username);
  const nama = _norm(params.nama) || '';
  if(!username) return { ok:false, error:'Username siswa kosong' };
  const rec = {
    username,
    nama,
    struktur: _norm(params.struktur),
    penyampaian: _norm(params.penyampaian),
    penguasaan: _norm(params.penguasaan),
    media: _norm(params.media),
    sikap: _norm(params.sikap),
    total: _norm(params.total),
    timestamp: new Date()
  };
  const sh = _sheet(SHEET_NILAI) || SpreadsheetApp.getActive().insertSheet(SHEET_NILAI);
  const header = ['username','nama','struktur','penyampaian','penguasaan','media','sikap','total','timestamp'];
  if(sh.getLastRow() === 0) sh.appendRow(header);
  const values = sh.getDataRange().getValues();
  const headerLower = values[0].map(h=>_norm(h).toLowerCase());
  const idxUser = headerLower.indexOf('username');
  for(let r=1;r<values.length;r++){
    if(String(values[r][idxUser]) === String(username)){
      const rowVals = header.map(k => rec[k] || '');
      sh.getRange(r+1, 1, 1, header.length).setValues([rowVals]);
      return { ok:true, updated:true, message:'Nilai diperbarui', data: rec };
    }
  }
  const rowVals = header.map(k => rec[k] || '');
  sh.appendRow(rowVals);
  return { ok:true, updated:false, message:'Nilai tersimpan', data: rec };
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

    // Protect sensitive data: require explicit dataset param.
    // If no dataset is provided, do not return sheet data by default.
    if (!dataset) {
      const out = { ok:false, error: 'Parameter dataset diperlukan. Akses langsung tidak diizinkan.' };
      return p.callback ? _jsonp(out, p.callback) : _json(out);
    }

    // AUTH (JSONP-capable)
    if(dataset === 'auth'){
      if((p.route||'').toLowerCase() === 'login'){
        const out = _auth_login(p.u, p.p);
        return _jsonp(out, p.callback);
      }
      if((p.route||'').toLowerCase() === 'check'){
        const sess = _auth_check(p.token);
        return _jsonp({ ok: !!sess, profile: sess ? sess.profile : null }, p.callback);
      }
      return _json({ ok:false, error:'Route tidak dikenal untuk dataset=auth' });
    }

    // UPLOADS listing
    if(dataset === 'uploads'){
      const sess = _auth_check(p.token);
      if(!sess) return _json({ ok:false, error:'Sesi tidak valid' });
      const rows = _readUploads();
      const route = (p.route||'').toLowerCase();
      let out;
      if(route === 'my'){
        const mine = rows.filter(r => r.username === sess.profile.username);
        out = { ok:true, route:'my', count:mine.length, data: mine };
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      if(route === 'students'){
        if(sess.profile.role !== 'guru') return _json({ ok:false, error:'Hanya guru yang dapat melihat uploads siswa' });
        const map = _mapGuruToStudents();
        const list = new Set();
        const nameGuru = sess.profile.nama || sess.profile.username;
        (map.pembimbing[nameGuru]||[]).forEach(s => list.add(s.nama));
        (map.penguji[nameGuru]||[]).forEach(s => list.add(s.nama));
        const names = Array.from(list);
        const data = rows.filter(r => names.includes(r.nama));
        out = { ok:true, route:'students', count:data.length, data };
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      return _json({ ok:false, error:'Route tidak dikenal untuk dataset=uploads. Gunakan route=my atau route=students' });
    }

    // PENGUJI (BARU)
    if(dataset === 'penguji'){
      if(p.route === 'meta'){
        const out = penguji_meta();
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      if(p.q){
        const out = penguji_search(p.q);
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      if(p.penguji){
        const out = penguji_by_nama(p.penguji);
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      const out = {ok:false,error:'Parameter kurang untuk dataset=penguji. Gunakan route=meta, q=, atau penguji='};
      return p.callback ? _jsonp(out, p.callback) : _json(out);
    }

    // NILAI PRESENTASI (dilindungi)
    if(dataset === 'nilaipresentasi'){
      const sess = _auth_check(p.token);
      if(!sess) return p.callback ? _jsonp({ ok:false, error:'Sesi tidak valid' }, p.callback) : _json({ ok:false, error:'Sesi tidak valid' });
      const rows = _readNilaiPresentasi();
      const out = { ok:true, route:'data', count: rows.length, data: rows };
      return p.callback ? _jsonp(out, p.callback) : _json(out);
    }

    // NILAI PKL (dilindungi)
    if(dataset === 'nilaipkl'){
      const sess = _auth_check(p.token);
      if(!sess) return p.callback ? _jsonp({ ok:false, error:'Sesi tidak valid' }, p.callback) : _json({ ok:false, error:'Sesi tidak valid' });
      const rows = _readNilaiPKL();
      const out = { ok:true, route:'data', count: rows.length, data: rows };
      return p.callback ? _jsonp(out, p.callback) : _json(out);
    }

    // NILAI UKK (dilindungi)
    if(dataset === 'nilaiukk'){
      const sess = _auth_check(p.token);
      if(!sess) return p.callback ? _jsonp({ ok:false, error:'Sesi tidak valid' }, p.callback) : _json({ ok:false, error:'Sesi tidak valid' });
      const rows = _readNilaiUKK();
      const out = { ok:true, route:'data', count: rows.length, data: rows };
      return p.callback ? _jsonp(out, p.callback) : _json(out);
    }

    // PEMBIMBING
    if(dataset === 'pembimbing'){
      if(p.route === 'meta'){
        const out = pembimbing_meta();
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      if(p.q){
        const out = pembimbing_search(p.q);
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      if(p.pembimbing){
        const out = pembimbing_by_nama(p.pembimbing);
        return p.callback ? _jsonp(out, p.callback) : _json(out);
      }
      const out = {ok:false,error:'Parameter kurang untuk dataset=pembimbing. Gunakan route=meta, q=, atau pembimbing='};
      return p.callback ? _jsonp(out, p.callback) : _json(out);
    }

    // PESERTA
    if(dataset === 'peserta'){
      if(p.route === 'meta') return _json(peserta_meta());
      if(p.q)                return _json(peserta_search(p.q));
      if(p.mitra)            return _json(peserta_by_mitra(p.mitra));
      return _json({ok:false,error:'Parameter kurang untuk dataset=peserta.'});
    }

  // Default: UKK (kompatibel dengan pola lama)
  // Allow public access only to meta route. Full ukk data requires authentication.
  if(p.route === 'meta') return p.callback ? _jsonp(ukk_meta(), p.callback) : _json(ukk_meta());
  // Public ukk data is allowed when dataset=ukk is provided. (The root/no-dataset case is already blocked above.)
  return p.callback ? _jsonp(ukk_data(p), p.callback) : _json(ukk_data(p));

  } catch(err) {
    return _json({ ok:false, error: err.message });
  }
}

function doPost(e){
  try{
    const p = (e && e.parameter) || {};
    const action = (_norm(p.action)||'').toLowerCase();
    if(action === 'upload'){
      return _handle_upload_(p);
    } else if(action === 'delete'){
      return _handle_delete_(p);
    } else if(action === 'save_nilai'){
      const out = _save_nilai_presentasi(p);
      // reply with small HTML that posts message to parent (like upload/delete)
      // include username and data when available so client can update optimistically
      const payload = { type: 'save_nilai', ok: !!out.ok, message: out.message || '' };
      try{ if(out.data && out.data.username) payload.username = out.data.username; payload.data = out.data; }catch(e){}
      const html = `<!doctype html><meta charset="utf-8"><title>Save Nilai</title><body>`+
        `${out.ok? '✅':'❌'} ${out.message}`+
        `<script>(function(){try{parent&&parent.postMessage&&parent.postMessage(${JSON.stringify(payload)}, '*');}catch(e){}; try{setTimeout(function(){ window.close && window.close(); }, 400);}catch(e){} })();</script></body>`;
      const resp = HtmlService.createHtmlOutput(html);
      resp.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      return resp;
    } else if(action === 'login'){
      const out = _auth_login(p.u, p.p);
      return _json(out);
    }
    return HtmlService.createHtmlOutput('<b>Unknown POST action</b>');
  } catch(err){
    return HtmlService.createHtmlOutput('Error: '+err.message);
  }
}

// Helper to compute hash in Sheets (optional): =HASH_SHA256("plaintext")
function HASH_SHA256(s){ return _hashSHA256(String(s||'')); }
