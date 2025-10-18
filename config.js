(function(){
  // Pusat konfigurasi aplikasi
  // Ganti BASE_URL sesuai deployment Google Apps Script Web App Anda
  const CONFIG = {
    BASE_URL: 'https://script.google.com/macros/s/AKfycbzyCzuVB3o_Yrloy6AxK-CdVp0bGpHBG3faiOg02-PAKyMNeNcklWeu0MKdWuCmsIlNvw/exec'
  };

  // Ekspor ke global dengan proteksi
  Object.freeze(CONFIG);
  window.APP_CONFIG = CONFIG;
  Object.freeze(window.APP_CONFIG);
  Object.seal(window.APP_CONFIG);
})();
