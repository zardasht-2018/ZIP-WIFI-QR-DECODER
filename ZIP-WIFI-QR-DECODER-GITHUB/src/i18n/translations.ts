/**
 * ZIP QR — Wi-Fi QR Decoder
 * Bilingual Localization Module: Kurdish Sorani (ckb, RTL, default) & English (en, LTR)
 */

export type SupportedLanguage = 'ckb' | 'en';

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ckb';
export const LANGUAGE_STORAGE_KEY = 'zip_qr_lang_v1';

export interface TranslationDictionary {
  brandPrimary: string;
  brandSecondary: string;
  brandDisplayTitle: string;
  tagline: string;
  navHome: string;
  navScanner: string;
  navResults: string;
  navHistory: string;
  navSettings: string;
  langKurdish: string;
  langEnglish: string;

  // Online / Offline / Cache Readiness Indicators
  statusOnline: string;
  statusOffline: string;
  statusOfflineReady: string;
  statusCachingProgress: string;
  statusOfflineIncomplete: string;
  statusOnlineAndReady: string;
  statusOfflineAndReady: string;
  statusOfflineUnavailable: string;

  // Home Page
  heroBadge: string;
  heroDescription: string;
  btnScanQrCode: string;
  btnUploadQrImage: string;
  card1Step: string;
  card1Title: string;
  card1Desc: string;
  card1Btn: string;
  card2Step: string;
  card2Title: string;
  card2Desc: string;
  card2Btn: string;
  card3Step: string;
  card3Title: string;
  card3Desc: string;
  card3Placeholder: string;
  card3Btn: string;
  recentHeading: string;
  recentSubheading: string;
  btnManageHistory: string;
  emptyRecentText: string;

  // Multi-QR Selection Modal
  multiQrTitle: string;
  multiQrSubtitle: string;
  btnSelectThisQr: string;

  // Scanner Page
  scannerTitle: string;
  scannerSubtitle: string;
  btnCancel: string;
  scannerRequestingCamera: string;
  scannerOpeningStream: string;
  scannerAlignPrompt: string;
  scannerFallbackTitle: string;
  scannerFallbackNoApi: string;
  scannerFallbackDenied: string;
  btnRetryCamera: string;
  btnFallbackUpload: string;
  defaultCameraLabel: string;
  cameraItemPrefix: string;
  btnSwitchCamera: string;
  flashlightOn: string;
  flashlightOff: string;
  flashlightNA: string;
  zoomLabel: string;
  btnUploadFromGallery: string;

  // Results Page
  resultsEmptyTitle: string;
  resultsEmptyDesc: string;
  btnScanAnother: string;
  btnCopySsid: string;
  sourcePrefix: string;
  decodedOnPrefix: string;
  extractedPasswordHeading: string;
  charsSuffix: string;
  btnShowPassword: string;
  btnHidePassword: string;
  btnCopyPassword: string;
  passwordExactNote: string;
  noPasswordEncodedMsg: string;
  openNetworkNoPasswordMsg: string;
  dppNoPasswordMsg: string;
  networkInfoHeading: string;
  infoLabel1Ssid: string;
  infoLabel2Password: string;
  infoLabel3Security: string;
  infoLabel4Hidden: string;
  infoLabel5Format: string;
  infoLabel6Extra: string;
  infoNoExtraParams: string;
  infoRawPayloadLabel: string;
  btnCopyAllInfo: string;
  btnDownloadTxt: string;
  btnDownloadJson: string;
  pasteAnotherHeading: string;
  pasteAnotherDesc: string;
  btnDecodePayload: string;
  hiddenYes: string;
  hiddenNo: string;
  hiddenNA: string;

  // History Page (Persistent IndexedDB with Saved Passwords)
  historyTitle: string;
  historySubtitle: string;
  historyStorageBadge: string;
  labelSaveHistory: string;
  btnClearAllHistory: string;
  modalClearTitle: string;
  modalClearDesc: string;
  btnConfirmClear: string;
  historySearchPlaceholder: string;
  historyEmptyText: string;
  historyNoMatchText: string;
  btnOpenResult: string;
  btnDeleteEntry: string;
  badgeHiddenSsid: string;
  badgeSavedPassword: string;
  historyPasswordExtractedPrefix: string;

  // Settings & System Information / Offline PWA Section
  settingsTitle: string;
  settingsSubtitle: string;
  settingsLanguageHeading: string;
  settingsLanguageDesc: string;
  settingsThemeHeading: string;
  theme1Title: string;
  theme1Desc: string;
  theme2Title: string;
  theme2Desc: string;
  theme3Title: string;
  theme3Desc: string;
  maskPasswordTitle: string;
  maskPasswordDesc: string;
  historyPrefsHeading: string;
  enableHistoryTitle: string;
  enableHistoryDesc: string;

  // Dedicated Settings Section: Application Information, PWA & Offline Capabilities
  sysInfoSectionHeading: string;
  sysInfoReadinessLabel: string;
  sysInfoPwaTitle: string;
  sysInfoPwaDesc: string;
  sysInfoOfflineTitle: string;
  sysInfoOfflineDesc: string;
  sysInfoFeaturesHeading: string;
  sysInfoFeat1: string;
  sysInfoFeat2: string;
  sysInfoFeat3: string;
  sysInfoFeat4: string;
  sysInfoFeat5: string;
  sysInfoFeat6: string;
  sysInfoFeat7: string;
  sysInfoFeat8: string;
  sysInfoConditionsHeading: string;
  sysInfoCond1: string;
  sysInfoCond2: string;
  sysInfoCond3: string;
  sysInfoCond4: string;
  pwaInstallHeading: string;
  pwaInstallDesc: string;
  btnInstallPwa: string;
  pwaInstalledBadge: string;
  pwaManualInstallHint: string;

  privacyHeading: string;
  privacyCard1Title: string;
  privacyCard1Desc: string;
  privacyCard2Title: string;
  privacyCard2Desc: string;
  privacyCard3Title: string;
  privacyCard3Desc: string;
  btnClearAllStoredData: string;
  confirmWipePrompt: string;
  btnConfirmWipe: string;

  // About & Developer Identity Section
  aboutHeading: string;
  aboutDescription: string;
  creatorSectionBadge: string;
  creatorNameLabel: string;
  creatorNameValue: string;
  creatorTitleLabel: string;
  creatorTitleValue: string;
  creatorProjectLabel: string;
  creatorProjectValue: string;
  creatorCreditLine: string;
  creatorContactBtn: string;
  creatorEmailLabel: string;

  // Footer & Notifications
  footerLeft: string;
  footerRight: string;
  toastPasswordExtracted: string;
  toastDecodedPayload: string;
  toastPasswordCopied: string;
  toastSsidCopied: string;
  toastAllCopied: string;
  toastDownloadedTxt: string;
  toastDownloadedJson: string;
  toastEnterPayload: string;
  toastHistoryEnabled: string;
  toastHistoryPaused: string;
  toastHistoryCleared: string;
  toastEntryDeleted: string;
  toastThemeUpdated: string;
  toastDataWiped: string;
  toastLanguageChanged: string;
  toastDecodeError: string;
  toastTorchUnsupported: string;
  toastMultipleQrFound: string;
  toastOfflineReadyConfirmed: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  ckb: {
    brandPrimary: 'ZIP QR',
    brandSecondary: 'Wi-Fi QR Decoder',
    brandDisplayTitle: 'ZIP QR — Wi-Fi QR Decoder',
    tagline: 'SCAN. REVEAL. CONNECT.',
    navHome: 'سەرەکی',
    navScanner: 'سکانەر',
    navResults: 'ئەنجامەکان',
    navHistory: 'مێژوو',
    navSettings: 'ڕێکخستنەکان',
    langKurdish: 'کوردی',
    langEnglish: 'English',

    // Online / Offline / Cache Readiness Indicators
    statusOnline: 'سەرهێڵ: پەیوەستە',
    statusOffline: 'دۆخی بێ ئینتەرنێت (Offline Mode)',
    statusOfflineReady: 'ئامادەیە بۆ کارکردن بەبێ ئینتەرنێت',
    statusCachingProgress: 'خەریکی پاشەکەوتکردنی فایلە پێویستەکانە...',
    statusOfflineIncomplete: 'ئامادەکاری کارکردنی بێ ئینتەرنێت تەواو نەبووە',
    statusOnlineAndReady: 'سەرهێڵ و ئامادەیە بۆ کارکردن بەبێ ئینتەرنێت',
    statusOfflineAndReady: 'دۆخی بێ ئینتەرنێت — ئامادەیە (کارکردن لە بیرگەی ناوخۆیی)',
    statusOfflineUnavailable: 'تایبەتمەندی Offline لەم ژینگەیەدا بەردەست نییە',

    // Home Page
    heroBadge: '١٠٠٪ شیکردنەوەی ناوخۆیی لەناو وێبگەڕ • کاردەکات بەبێ ئینتەرنێت (Offline PWA)',
    heroDescription:
      'هەر کۆدێکی QRـی وای-فای بە کامێرا سکان بکە یان وێنەی QR باربکە (PNG، JPG، JPEG، WEBP) بۆ دەرهێنان و پیشاندانی دەستبەجێی تێپەڕەوشەی وای-فای، ناوی تۆڕ (SSID)، جۆری پاراستن (WPA، WPA2، WPA3، WEP، کراوە، DPP)، و پاشەکەوتکردنی تەواوی مێژوو لەسەر ئامێرەکەت.',
    btnScanQrCode: 'سکانکردنی کۆدی QR',
    btnUploadQrImage: 'بارکردنی وێنەی QR',
    card1Step: '١. کامێرای ڕاستەوخۆ',
    card1Title: 'سکانکردنی کۆدی QR',
    card1Desc:
      'کامێرای ئامێرەکەت بکەرەوە بۆ ناسینەوە و خوێندنەوەی خودکارانەی کۆدی QRـی وای-فای بە شێوەی ڕاستەوخۆ.',
    card1Btn: 'کردنەوەی سکانەری کامێرا',
    card2Step: '٢. هەڵبژاردنی وێنە و ڕاکێشان',
    card2Title: 'بارکردنی وێنەی QR',
    card2Desc:
      'فایلی وێنەی کۆدی QR (PNG، JPG، JPEG، یان WEBP) لە گەلەری مۆبایل یان کۆمپیوتەرەکەت هەڵبژێرە یان ڕایبکێشە بۆ ئێرە.',
    card2Btn: 'هەڵبژاردنی وێنەی QR',
    card3Step: '٣. دەقی ڕاستەوخۆی کۆد',
    card3Title: 'لکاندنی ناوەڕۆکی QR',
    card3Desc:
      'دەقی ناوەڕۆکی کۆدی QRـی وای-فای (WIFI:...;; یان DPP:...;;) لێرە بلکێنە بۆ دەرهێنانی زانیارییەکانی بە دەستبەجێ.',
    card3Placeholder: 'دەقی WIFI:... یان DPP:... لێرە بلکێنە',
    card3Btn: 'شیکردنەوەی ناوەڕۆکی QR',
    recentHeading: 'کۆدە سکانکراوەکانی دوایی',
    recentSubheading: 'پاشەکەوتکراوە لە بنکەدراوەی ناوخۆیی وێبگەڕ (IndexedDB) لەگەڵ تێپەڕەوشەکان',
    btnManageHistory: 'بەڕێوەبردنی مێژوو',
    emptyRecentText:
      'هێشتا هیچ کۆدێکی QR سکان نەکراوە. لە سەرەوە سکانکردنی کۆدی QR، بارکردنی وێنەی QR، یان لکاندنی ناوەڕۆکی QR بەکاربهێنە.',

    // Multi-QR Selection Modal
    multiQrTitle: 'چەند کۆدێکی QR لە وێنەکەدا دۆزرایەوە',
    multiQrSubtitle: 'تکایە ئەو کۆدەی QR هەڵبژێرە کە دەتەوێت زانیاری و تێپەڕەوشەکەی ببینیت:',
    btnSelectThisQr: 'بینینی ئەم کۆدە',

    // Scanner Page
    scannerTitle: 'سکانەری ڕاستەوخۆی QRـی وای-فای',
    scannerSubtitle:
      'کۆدی QRـی وای-فای بخەرە ناو چوارچێوەکە یان وێنەیەک لە گەلەری ئامێرەکەت هەڵبژێرە.',
    btnCancel: 'پاشگەزبوونەوە',
    scannerRequestingCamera: 'داواکردنی مۆڵەتی کامێرا...',
    scannerOpeningStream: 'کردنەوەی پەخشی کامێرا...',
    scannerAlignPrompt: 'کۆدی QRـی وای-فای بخەرە ناو چوارچێوەی سکانکردن...',
    scannerFallbackTitle: 'کامێرا بەردەست نییە — بارکردنی وێنە چالاکە',
    scannerFallbackNoApi:
      'تایبەتمەندی کامێرا (getUserMedia) لەم وێبگەڕەدا بەردەست نییە. دەتوانیت ڕاستەوخۆ هەر وێنەیەکی PNG، JPG، یان WEBP باربکەیت.',
    scannerFallbackDenied:
      'مۆڵەتی کامێرا ڕەتکرایەوە یان هیچ کامێرایەک لەسەر ئەم ئامێرە نەدۆزرایەوە. دوگمەی بارکردنی وێنەی QR لە خوارەوە بەکاربهێنە.',
    btnRetryCamera: 'هەوڵدانەوەی کامێرا',
    btnFallbackUpload: 'بارکردنی وێنەی QR لەبری کامێرا',
    defaultCameraLabel: 'کامێرای بنەڕەتی ئامێر',
    cameraItemPrefix: 'کامێرا',
    btnSwitchCamera: 'گۆڕینی کامێرا',
    flashlightOn: 'فلاش: داگیرساوە',
    flashlightOff: 'فلاش: کوژاوەتەوە',
    flashlightNA: 'فلاش بەردەست نییە',
    zoomLabel: 'نزیککردنەوە (Zoom)',
    btnUploadFromGallery: 'بارکردن لە گەلەرییەوە',

    // Results Page
    resultsEmptyTitle: 'هێشتا هیچ کۆدێکی QR سکان نەکراوە',
    resultsEmptyDesc:
      'لە پەڕەی سەرەکی کۆدێکی QRـی وای-فای بە کامێرا سکان بکە، وێنەیەک باربکە، یان دەقی کۆدەکە بلکێنە.',
    btnScanAnother: 'سکانکردنی کۆدێکی تر',
    btnCopySsid: 'لەبەرگرتنەوەی ناوی تۆڕ (SSID)',
    sourcePrefix: 'سەرچاوە:',
    decodedOnPrefix: 'شیکراوەتەوە لە ڕێکەوتی',
    extractedPasswordHeading: 'تێپەڕەوشەی دەرهێنراوی وای-فای',
    charsSuffix: 'پیت/هێما',
    btnShowPassword: 'پیشاندانی تێپەڕەوشە',
    btnHidePassword: 'شاردنەوەی تێپەڕەوشە',
    btnCopyPassword: 'لەبەرگرتنەوەی تێپەڕەوشە',
    passwordExactNote:
      'ڕاستەوخۆ و بە شێوەی ناوخۆیی لە ناوەڕۆکی کۆدی QR دەرهێنراوە و لە بنکەدراوەی ناوخۆیی وێبگەڕەکەت پاشەکەوت کراوە.',
    noPasswordEncodedMsg: 'هیچ تێپەڕەوشەیەک لەم کۆدی QRـەدا تۆمار نەکراوە.',
    openNetworkNoPasswordMsg: 'تۆڕی کراوە — پێویستی بە تێپەڕەوشە نییە.',
    dppNoPasswordMsg:
      'هیچ تێپەڕەوشەیەک لەم کۆدی QRـەدا تۆمار نەکراوە. پڕۆتۆکۆلی DPP کلیلی گشتی نهێنیبەندی بەکاردەهێنێت لەبری تێپەڕەوشەی ئاسایی.',
    networkInfoHeading: 'زانیارییەکانی تۆڕ',
    infoLabel1Ssid: '١. ناوی تۆڕی وای-فای (SSID)',
    infoLabel2Password: '٢. تێپەڕەوشەی وای-فای',
    infoLabel3Security: '٣. جۆری پاراستن (Security Type)',
    infoLabel4Hidden: '٤. دۆخی تۆڕی شاراوە',
    infoLabel5Format: '٥. جۆری فۆرماتی کۆدی QR',
    infoLabel6Extra: '٦. زانیارییە زیادە تۆمارکراوەکانی ناو کۆدی QR',
    infoNoExtraParams: 'هیچ پارامێتەرێکی زیادە لەم کۆدی QRـەدا بوونی نییە.',
    infoRawPayloadLabel: 'دەقی ڕەسەنی ناوەڕۆکی کۆدی QR',
    btnCopyAllInfo: 'لەبەرگرتنەوەی هەموو زانیارییەکان',
    btnDownloadTxt: 'داگرتنی ئەنجامەکان (.TXT)',
    btnDownloadJson: 'داگرتنی ئەنجامەکان (.JSON)',
    pasteAnotherHeading: 'پشکنەری دەقی ناوەڕۆکی کۆدی QR',
    pasteAnotherDesc:
      'هەر دەقێکی WIFI:T:...;S:...;P:...;; یان DPP:...;; لێرە بلکێنە بۆ شیکردنەوەی ڕاستەوخۆ:',
    btnDecodePayload: 'شیکردنەوەی دەق',
    hiddenYes: 'بەڵێ',
    hiddenNo: 'نەخێر',
    hiddenNA: 'بەردەست نییە',

    // History Page
    historyTitle: 'مێژووی سکانکردن',
    historySubtitle:
      'تۆمارە پاشەکەوتکراوەکانی وای-فای لەگەڵ تێپەڕەوشەکانیان لە بنکەدراوەی ناوخۆیی وێبگەڕ (IndexedDB) هەڵگیراون و دوای داخستنی وێبگەڕ دەمێننەوە.',
    historyStorageBadge: 'بنکەدراوەی هەمیشەیی IndexedDB • تەنها لەسەر ئەم ئامێرە',
    labelSaveHistory: 'پاشەکەوتکردنی مێژووی سکان',
    btnClearAllHistory: 'سڕینەوەی هەموو مێژوو',
    modalClearTitle: 'دڵنیابوونەوە لە سڕینەوەی تەواوی مێژوو',
    modalClearDesc:
      'ئایا دڵنیایت کە دەتەوێت هەموو تۆمارەکانی مێژووی سکان و تێپەڕەوشە پاشەکەوتکراوەکان بە هەمیشەیی لە بنکەدراوەی وێبگەڕەکەت بسڕیتەوە؟',
    btnConfirmClear: 'بەڵێ، هەمووی بسڕەوە',
    historySearchPlaceholder: 'گەڕان لە مێژوودا بەپێی ناوی تۆڕ (SSID)، جۆری پاراستن، یان فۆرمات...',
    historyEmptyText: 'مێژووی ناوخۆیی سکانکردن لە ئێستادا بەتاڵە.',
    historyNoMatchText: 'هیچ تۆمارێکی مێژوو لەگەڵ گەڕانەکەت ناگونجێت.',
    btnOpenResult: 'وردەکاری تەواو',
    btnDeleteEntry: 'سڕینەوە',
    badgeHiddenSsid: 'تۆڕی شاراوە',
    badgeSavedPassword: 'تێپەڕەوشە پاشەکەوتکراوە',
    historyPasswordExtractedPrefix: 'تێپەڕەوشە پاشەکەوتکراوە',

    // Settings & System Information / Offline PWA Section
    settingsTitle: 'ڕێکخستنەکان، تایبەتمەندی و زانیاری سیستەم',
    settingsSubtitle:
      'گۆڕینی زمان، ڕووکاری ڕەنگەکان، کۆنترۆڵکردنی تایبەتمەندی داتای ناوخۆیی، و زانیاری کارکردنی بێ ئینتەرنێت (PWA).',
    settingsLanguageHeading: 'زمان / Language',
    settingsLanguageDesc: 'زمانی پیشاندانی بەرنامەکە هەڵبژێرە (بە شێوەی خودکارانە پاشەکەوت دەکرێت).',
    settingsThemeHeading: 'ڕێکخستنی ڕووکار (Theme)',
    theme1Title: 'شینی کارەبایی و مۆر',
    theme1Desc: 'ڕووکاری تاریکی بنەڕەتی ZIP QR',
    theme2Title: 'ڕووکاری وەنەوشەیی سایبەر',
    theme2Desc: 'ڕەنگی تاریکی قووڵ لەگەڵ درەوشانەوەی وەنەوشەیی',
    theme3Title: 'قەڵغانی زومڕەدی',
    theme3Desc: 'ڕووکاری تاریکی جیاوازی بەرز',
    maskPasswordTitle: 'شاردنەوەی تێپەڕەوشە بە شێوەی بنەڕەتی لە پەڕەی ئەنجامەکان',
    maskPasswordDesc:
      'سەرەتا تێپەڕەوشەکە بە شاراوەیی (••••••••) پیشان بدە تا ئەو کاتەی کرتە لە پیشاندانی تێپەڕەوشە دەکەیت (لە پەڕەی مێژوودا هەمیشە بە شاراوەیی پیشان دەدرێت).',
    historyPrefsHeading: 'ڕێکخستنەکانی مێژووی IndexedDB',
    enableHistoryTitle: 'چالاککردنی مێژووی هەمیشەیی ناوخۆیی (لەگەڵ تێپەڕەوشەکان)',
    enableHistoryDesc:
      'پاشەکەوتکردنی خودکارانەی تۆڕە سکانکراوەکان و تێپەڕەوشەی ڕاستەقینەی وای-فای لە بنکەدراوەی IndexedDBـی وێبگەڕەکەت تا دوای داخستنی وێبگەڕ یان کوژاندنەوەی ئامێرەکەش بمێننەوە.',

    // Dedicated Settings Section: Application Information, PWA & Offline Capabilities
    sysInfoSectionHeading: 'زانیاری بەرنامە و توانای کارکردن بەبێ ئینتەرنێت (PWA)',
    sysInfoReadinessLabel: 'دۆخی ئامادەیی کارکردنی بێ ئینتەرنێت:',
    sysInfoPwaTitle: 'دەربارەی ZIP QR',
    sysInfoPwaDesc:
      'ZIP QR بەرنامەیەکی وێبی پێشکەوتووە (Progressive Web App - PWA) کە دەتوانیت لە وێبگەڕە پشتگیریکراوەکان بەکاریبهێنیت و لە ئامێرە پشتگیریکراوەکان وەک ئەپێک دایمەزرێنیت.',
    sysInfoOfflineTitle: 'کارکردن بەبێ ئینتەرنێت',
    sysInfoOfflineDesc:
      'ZIP QR دەتوانێت دوای یەکەم جار کردنەوەی سەرکەوتووی بەرنامەکە بە ئینتەرنێت و تەواوبوونی پاشەکەوتکردنی فایلە پێویستەکان، بەبێ پەیوەندی بە ئینتەرنێتیش کار بکات.',
    sysInfoFeaturesHeading: 'لە دوای ئامادەبوونی Offline Mode، دەتوانیت:',
    sysInfoFeat1: 'QR Code بە کامێرا بسکەنیت.',
    sysInfoFeat2: 'وێنەی QR Upload بکەیت و بخوێنیتەوە.',
    sysInfoFeat3: 'زانیارییەکانی Wi-Fi و پاسوۆردەکە بدۆزیتەوە.',
    sysInfoFeat4: 'مێژووی Scan ـەکانت ببینیت.',
    sysInfoFeat5: 'پاسوۆردە پاشەکەوتکراوەکانت ببینیت و کۆپی بکەیت.',
    sysInfoFeat6: 'تۆماری نوێی سکان لە بنکەدراوەی ناوخۆیی پاشەکەوت بکەیت.',
    sysInfoFeat7: 'زمان بگۆڕیت لە نێوان کوردی سۆرانی و ئینگلیزی.',
    sysInfoFeat8: 'Settings و زانیارییەکانی بەرنامەکە بەکاربهێنیت.',
    sysInfoConditionsHeading: 'تێبینی گرنگ:',
    sysInfoCond1:
      'بۆ یەکەم جار باربوونی بەرنامەکە، دامەزراندن، و وەرگرتنی نوێکارییەکان پێویستت بە ئینتەرنێت هەیە.',
    sysInfoCond2:
      'سکەنکردن بە کامێرا پێویستی بە HTTPS، ڕێگەپێدانی کامێرا و وێبگەڕێکی پشتگیریکار هەیە.',
    sysInfoCond3:
      'سڕینەوەی داتای وێبگەڕ یان Site Data ڕەنگە مێژوو و فایلە پاشەکەوتکراوەکان بسڕێتەوە، و سیاسەتی بیرگەی وێبگەڕ کار دەکاتە سەر مانەوەی داتا.',
    sysInfoCond4:
      'کارکردنی بێ ئینتەرنێت ناتوانێت تێپەڕەوشەیەک بگەڕێنێتەوە کە هەرگیز لەناو کۆدی QRـەکەدا تۆمار نەکرابێت.',
    pwaInstallHeading: 'دامەزراندنی بەرنامەی ZIP QR لەسەر ئامێرەکەت',
    pwaInstallDesc:
      'دەتوانیت ZIP QR لەسەر مۆبایل یان کۆمپیوتەرەکەت دابمەزرێنیت بۆ ئەزموونێکی وەک ئەپی سەربەخۆ. بەردەستبوونی دامەزراندن بەندە بە وێبگەڕ و سیستەمی کارپێکردنی ئامێرەکەت.',
    btnInstallPwa: 'دامەزراندنی ئەپی ZIP QR',
    pwaInstalledBadge: 'ئەپەکە دامەزراوە (کارکردن وەک ئەپی سەربەخۆ)',
    pwaManualInstallHint:
      'بۆ دامەزراندن: لە مێنوی وێبگەڕەکەت هەڵبژاردنی "Add to Home Screen" (لە iPhone/Android) یان ئایکۆنی "Install ZIP QR" لە شریتی ناونیشانی وێبگەڕەکەت بەکاربهێنە.',

    privacyHeading: 'زانیاری تایبەتمەندی و ڕاستگۆیی تەکنیکی',
    privacyCard1Title: '١٠٠٪ کارکردن لەسەر ئامێری بەکارهێنەر (بێ سێرڤەر)',
    privacyCard1Desc:
      'پەخشی کامێرا، وێنە بارکراوەکانی QR، و تێپەڕەوشەکانی وای-فای بە تەواوی لەناو وێبگەڕەکەت شیدەکرێنەوە. هیچ زانیارییەک هەرگیز بۆ هیچ سێرڤەر یان لایەنێکی دەرەکی نانێردرێت.',
    privacyCard2Title: 'تایبەتمەندی و سنووردارێتی بیرگەی ناوخۆیی (IndexedDB)',
    privacyCard2Desc:
      'مێژوو و تێپەڕەوشەکان لەسەر پڕۆفایلی وێبگەڕی ئەم ئامێرە هەڵدەگیرێن بەبێ پێویستی بە چوونەژوورەوە. تێپەڕەوشەکان لە ڕووکاردا بە هێمای (••••••••) دەشاردرێنەوە، بەڵام هەر کەسێک دەستی بگاتە هەمان پڕۆفایلی وێبگەڕ و داتای ئامێرەکەت دەتوانێت بیانبینێت.',
    privacyCard3Title: 'پاراستنی داتای دەرەکی و نوێکردنەوەی سەلامەت',
    privacyCard3Desc:
      'نوێکردنەوەی بەرنامەکە (PWA Service Worker) تەنها فایلە کاتییەکانی ڕووکار نوێ دەکاتەوە و هەرگیز بنکەدراوەی مێژووی وای-فایەکانت ناسڕێتەوە.',
    btnClearAllStoredData: 'سڕینەوەی هەموو داتا پاشەکەوتکراوەکان (مێژووی IndexedDB و ڕێکخستنەکان)',
    confirmWipePrompt: 'دڵنیایت لە سڕینەوەی هەموو مێژووی IndexedDB و گەڕاندنەوەی ڕێکخستنەکان بۆ دۆخی بنەڕەتی؟',
    btnConfirmWipe: 'تەواو، هەمووی بسڕەوە',

    // About & Developer Identity Section
    aboutHeading: 'دەربارەی گەشەپێدەر و پڕۆژەی ZIP QR',
    aboutDescription:
      'ZIP QR — Wi-Fi QR Decoder (وەشانی PWA) — SCAN. REVEAL. CONNECT. دیزاین کراوە بۆ ئایفۆن، ئایپاد، مۆبایل و تابلێتەکانی ئەندرۆید، ویندۆز، ماکبووک، و کۆمپیوتەرەکانی لینوکس. پشتگیری لە تۆڕەکانی WPA، WPA2، WPA3-SAE، WPA2-EAP، WEP، تۆڕە کراوەکان (nopass)، تۆڕە شاراوەکان، هێما تایبەتەکان (\\; \\, \\: \\\\ \\")، و کۆدەکانی Wi-Fi Easy Connect (DPP:) دەکات.',
    creatorSectionBadge: 'زانیاری گەشەپێدەر و دروستکەر',
    creatorNameLabel: 'ناو',
    creatorNameValue: 'زەردەشت محمد (Zardasht Muhammad)',
    creatorTitleLabel: 'ناونیشانی پیشەیی',
    creatorTitleValue: 'گەشەپێدەر و دروستکەر (Developer & Creator)',
    creatorProjectLabel: 'پڕۆژە',
    creatorProjectValue: 'ZIP QR — Wi-Fi QR Decoder',
    creatorCreditLine: 'دروستکراو و پەرەپێدراوە لەلایەن زەردەشت محمد.',
    creatorContactBtn: 'پەیوەندیکردن بە ئیمەیڵ',
    creatorEmailLabel: 'ئیمەیڵی پەیوەندی',

    // Footer & Notifications
    footerLeft: 'ZIP QR — Wi-Fi QR Decoder • SCAN. REVEAL. CONNECT.',
    footerRight: '١٠٠٪ شیکردنەوەی ناوخۆیی کۆدی QR لەناو وێبگەڕ • کاردەکات بەبێ ئینتەرنێت (Offline PWA)',
    toastPasswordExtracted: 'تێپەڕەوشە دەرهێنرا و لە مێژوو پاشەکەوت کرا بۆ',
    toastDecodedPayload: 'کۆدی QR بە سەرکەوتوویی شیکرایەوە',
    toastPasswordCopied: 'تێپەڕەوشەی وای-فای لەبەرگیرایەوە!',
    toastSsidCopied: 'ناوی تۆڕ (SSID) لەبەرگیرایەوە!',
    toastAllCopied: 'هەموو زانیارییەکانی تۆڕ لەبەرگیرانەوە!',
    toastDownloadedTxt: 'ڕاپۆرتی ئەنجامەکان داگیرا (.txt)',
    toastDownloadedJson: 'فایلی داتای ئەنجامەکان داگیرا (.json)',
    toastEnterPayload: 'تکایە دەقی ناوەڕۆکی کۆدی QR بنووسە یان بلکێنە بۆ شیکردنەوە.',
    toastHistoryEnabled: 'پاشەکەوتکردنی مێژووی سکان لە IndexedDB چالاک کرا.',
    toastHistoryPaused: 'پاشەکەوتکردنی مێژووی سکان ڕاگیرا.',
    toastHistoryCleared: 'تەواوی مێژووی سکان لە IndexedDB سڕایەوە.',
    toastEntryDeleted: 'تۆمارەکە لە مێژووی سکان سڕایەوە.',
    toastThemeUpdated: 'ڕووکاری بەرنامە نوێکرایەوە.',
    toastDataWiped: 'هەموو داتای IndexedDB و ڕێکخستنە ناوخۆییەکان سڕانەوە.',
    toastLanguageChanged: 'زمان گۆڕدرا بۆ کوردی سۆرانی.',
    toastDecodeError: 'هیچ کۆدێکی دروستی QR لەم وێنەیەدا نەدۆزرایەوە.',
    toastTorchUnsupported: 'کۆنترۆڵکردنی فلاش لەسەر ئەم کامێرایە پشتگیری ناکرێت.',
    toastMultipleQrFound: 'چەند کۆدێکی QR لە وێنەکەدا دۆزرایەوە — دانەیەکیان هەڵبژێرە.',
    toastOfflineReadyConfirmed: 'هەموو فایلە پێویستەکان پاشەکەوت کران — ئامادەیە بۆ کارکردن بەبێ ئینتەرنێت.',
  },

  en: {
    brandPrimary: 'ZIP QR',
    brandSecondary: 'Wi-Fi QR Decoder',
    brandDisplayTitle: 'ZIP QR — Wi-Fi QR Decoder',
    tagline: 'SCAN. REVEAL. CONNECT.',
    navHome: 'Home',
    navScanner: 'Scanner',
    navResults: 'Results',
    navHistory: 'History',
    navSettings: 'Settings',
    langKurdish: 'کوردی',
    langEnglish: 'English',

    // Online / Offline / Cache Readiness Indicators
    statusOnline: 'Online: Connected',
    statusOffline: 'Offline: Offline Mode',
    statusOfflineReady: 'Ready for Offline Use',
    statusCachingProgress: 'Essential resources still caching...',
    statusOfflineIncomplete: 'Offline preparation incomplete',
    statusOnlineAndReady: 'Online and ready for offline use',
    statusOfflineAndReady: 'Offline and ready (running from local cache)',
    statusOfflineUnavailable: 'Offline capability unavailable in this browser context',

    // Home Page
    heroBadge: '100% Local In-Browser Decoding • Full Offline PWA Support',
    heroDescription:
      'Scan any Wi-Fi QR code with your camera or upload a QR image (PNG, JPG, JPEG, WEBP) to immediately extract and reveal the exact encoded Wi-Fi Password, SSID, Security Type (WPA, WPA2, WPA3, WEP, Open, DPP), and keep persistent local History on your device.',
    btnScanQrCode: 'SCAN QR CODE',
    btnUploadQrImage: 'UPLOAD QR IMAGE',
    card1Step: '1. Live Camera',
    card1Title: 'SCAN QR CODE',
    card1Desc:
      'Open your device camera to automatically detect and decode a physical Wi-Fi QR code in real time.',
    card1Btn: 'OPEN CAMERA SCANNER',
    card2Step: '2. Image Picker & Dropzone',
    card2Title: 'UPLOAD QR IMAGE',
    card2Desc:
      'Select or drag and drop a QR image file (PNG, JPG, JPEG, or WEBP) from your gallery or computer.',
    card2Btn: 'SELECT QR IMAGE',
    card3Step: '3. Direct Payload',
    card3Title: 'PASTE QR CONTENT',
    card3Desc:
      'Paste an actual Wi-Fi QR payload string (WIFI:...;; or DPP:...;;) to extract its credentials immediately.',
    card3Placeholder: 'Paste WIFI:... or DPP:... payload here',
    card3Btn: 'DECODE QR CONTENT',
    recentHeading: 'Recently Scanned Codes',
    recentSubheading: 'Persisted in your browser IndexedDB database with saved Wi-Fi passwords',
    btnManageHistory: 'Manage History',
    emptyRecentText:
      'No QR codes scanned yet. Use SCAN QR CODE, UPLOAD QR IMAGE, or PASTE QR CONTENT above to decode a QR code.',

    // Multi-QR Selection Modal
    multiQrTitle: 'Multiple QR Codes Detected in Image',
    multiQrSubtitle: 'Select which detected QR code you want to inspect:',
    btnSelectThisQr: 'Open This QR Code',

    // Scanner Page
    scannerTitle: 'Live Wi-Fi QR Scanner',
    scannerSubtitle:
      'Align the Wi-Fi QR code inside the frame or select an image from your gallery.',
    btnCancel: 'Cancel',
    scannerRequestingCamera: 'Requesting camera access...',
    scannerOpeningStream: 'Opening camera stream...',
    scannerAlignPrompt: 'Align Wi-Fi QR code within the scanning frame...',
    scannerFallbackTitle: 'Camera Unavailable — Image Upload Active',
    scannerFallbackNoApi:
      'Camera API (getUserMedia) is unavailable in this browser context. You can upload any PNG, JPG, or WEBP QR image directly.',
    scannerFallbackDenied:
      'Camera access was denied or no camera hardware was detected. Use the Upload QR Image button below to decode from a file.',
    btnRetryCamera: 'Retry Camera',
    btnFallbackUpload: 'Upload QR Image Instead',
    defaultCameraLabel: 'Default Environment Camera',
    cameraItemPrefix: 'Camera',
    btnSwitchCamera: 'Switch Camera',
    flashlightOn: 'Flashlight: ON',
    flashlightOff: 'Flashlight: OFF',
    flashlightNA: 'Flashlight N/A',
    zoomLabel: 'Zoom',
    btnUploadFromGallery: 'Upload from Gallery',

    // Results Page
    resultsEmptyTitle: 'No QR Code Scanned Yet',
    resultsEmptyDesc:
      'Scan a Wi-Fi QR code with your camera, upload a QR image, or paste QR content on the Home page.',
    btnScanAnother: 'SCAN ANOTHER CODE',
    btnCopySsid: 'Copy SSID',
    sourcePrefix: 'Source:',
    decodedOnPrefix: 'Decoded on',
    extractedPasswordHeading: 'EXTRACTED WI-FI PASSWORD',
    charsSuffix: 'chars',
    btnShowPassword: 'SHOW PASSWORD',
    btnHidePassword: 'HIDE PASSWORD',
    btnCopyPassword: 'COPY PASSWORD',
    passwordExactNote:
      'Decoded locally directly from the QR code payload with full special-character unescaping and saved to local IndexedDB History.',
    noPasswordEncodedMsg: 'No password is encoded in this QR code.',
    openNetworkNoPasswordMsg: 'Open network — no password required.',
    dppNoPasswordMsg:
      'No password is encoded in this QR code. DPP uses cryptographic public-key bootstrapping instead of a plaintext Wi-Fi password.',
    networkInfoHeading: 'NETWORK INFORMATION',
    infoLabel1Ssid: '1. Wi-Fi Name (SSID)',
    infoLabel2Password: '2. Wi-Fi Password',
    infoLabel3Security: '3. Security Type',
    infoLabel4Hidden: '4. Hidden Network Status',
    infoLabel5Format: '5. QR Payload Format',
    infoLabel6Extra: '6. Additional Information Actually Present in QR Code',
    infoNoExtraParams: 'No additional optional parameters are encoded in this QR code.',
    infoRawPayloadLabel: 'Exact Raw QR Payload',
    btnCopyAllInfo: 'COPY ALL INFORMATION',
    btnDownloadTxt: 'DOWNLOAD RESULTS (.TXT)',
    btnDownloadJson: 'DOWNLOAD RESULTS (.JSON)',
    pasteAnotherHeading: 'Raw QR Payload String Tester',
    pasteAnotherDesc:
      'Paste any raw WIFI:T:...;S:...;P:...;; or DPP:...;; string to decode it directly:',
    btnDecodePayload: 'Decode Payload',
    hiddenYes: 'Yes',
    hiddenNo: 'No',
    hiddenNA: 'N/A',

    // History Page
    historyTitle: 'Scan History',
    historySubtitle:
      'Previously scanned networks and their actual Wi-Fi passwords are stored persistently in local browser IndexedDB across sessions and restarts.',
    historyStorageBadge: 'Persistent IndexedDB Storage • Strictly Local on This Device',
    labelSaveHistory: 'Save Scan History',
    btnClearAllHistory: 'Clear All History',
    modalClearTitle: 'Confirm Clearing All Scan History',
    modalClearDesc:
      'Are you sure you want to permanently delete all saved scan history records and passwords from your browser IndexedDB database?',
    btnConfirmClear: 'Yes, Delete All',
    historySearchPlaceholder:
      'Search history by network name (SSID), security protocol, or format...',
    historyEmptyText: 'Your local scan history is currently empty.',
    historyNoMatchText: 'No scan history entries match your search filter.',
    btnOpenResult: 'Full Details',
    btnDeleteEntry: 'Delete',
    badgeHiddenSsid: 'Hidden SSID',
    badgeSavedPassword: 'Saved Password',
    historyPasswordExtractedPrefix: 'Saved password',

    // Settings & System Information / Offline PWA Section
    settingsTitle: 'Settings, Privacy & System Information',
    settingsSubtitle:
      'Customize language, theme accents, local IndexedDB storage controls, and inspect PWA & offline capabilities.',
    settingsLanguageHeading: 'Language / زمان',
    settingsLanguageDesc: 'Select the application interface language (saved automatically).',
    settingsThemeHeading: 'Theme Settings',
    theme1Title: 'Electric Blue & Purple',
    theme1Desc: 'Default ZIP dark neon palette',
    theme2Title: 'Cyber Violet Core',
    theme2Desc: 'Deep obsidian with violet accents',
    theme3Title: 'Emerald Security',
    theme3Desc: 'High-contrast tactical dark theme',
    maskPasswordTitle: 'Mask Password by Default on Results Page',
    maskPasswordDesc:
      'Start with password masked (••••••••) on the Results page until you tap SHOW PASSWORD (passwords in History are always masked by default).',
    historyPrefsHeading: 'IndexedDB History Preferences',
    enableHistoryTitle: 'Enable Persistent Local History (Including Wi-Fi Passwords)',
    enableHistoryDesc:
      'Automatically save scanned networks and actual Wi-Fi passwords in your browser IndexedDB database so they remain available after closing the browser or restarting your device.',

    // Dedicated Settings Section: Application Information, PWA & Offline Capabilities
    sysInfoSectionHeading: 'Application Information & Offline Capabilities (PWA)',
    sysInfoReadinessLabel: 'Current Offline Readiness Status:',
    sysInfoPwaTitle: 'About ZIP QR',
    sysInfoPwaDesc:
      'ZIP QR is a Progressive Web App (PWA). You can use it through a supported web browser and install it on supported devices for an app-like experience.',
    sysInfoOfflineTitle: 'Offline Functionality',
    sysInfoOfflineDesc:
      'ZIP QR can work without an internet connection after your first successful online visit and once all essential application files have been successfully cached.',
    sysInfoFeaturesHeading: 'When offline readiness is complete, you can:',
    sysInfoFeat1: 'Scan QR codes using your camera.',
    sysInfoFeat2: 'Upload and decode QR images.',
    sysInfoFeat3: 'Extract encoded Wi-Fi information and passwords.',
    sysInfoFeat4: 'View your local scan History.',
    sysInfoFeat5: 'Reveal and copy previously saved Wi-Fi passwords.',
    sysInfoFeat6: 'Save new scans locally in IndexedDB.',
    sysInfoFeat7: 'Switch between supported languages (Kurdish Sorani & English).',
    sysInfoFeat8: 'Access application settings and local information.',
    sysInfoConditionsHeading: 'Important Conditions & Limitations:',
    sysInfoCond1:
      'The first successful visit, initial caching, and application updates require an internet connection.',
    sysInfoCond2:
      'Live camera scanning requires HTTPS, camera permission, and a supported browser.',
    sysInfoCond3:
      'Clearing browser or site data may remove saved History and cached application files, and browser storage policies may affect persistent data.',
    sysInfoCond4:
      'Offline functionality cannot recover information that was never encoded inside a QR code (such as DPP public-key codes).',
    pwaInstallHeading: 'Install ZIP QR on Your Device',
    pwaInstallDesc:
      'Install ZIP QR on your device for a more app-like experience. Installation availability depends on your browser and operating system.',
    btnInstallPwa: 'Install ZIP QR App',
    pwaInstalledBadge: 'Installed (Running in Standalone App Mode)',
    pwaManualInstallHint:
      'To install: Open your browser menu and select "Add to Home Screen" (iOS/Android) or click the "Install ZIP QR" icon in the address bar (Desktop Chrome/Edge).',

    privacyHeading: 'Privacy Architecture & Technical Transparency',
    privacyCard1Title: '100% Client-Side Execution (Zero Server Uploads)',
    privacyCard1Desc:
      'Camera frames, uploaded QR images, SSIDs, and Wi-Fi passwords are decoded and stored strictly inside your browser. No scan data is ever sent to Cloudflare Functions, external APIs, or analytics servers.',
    privacyCard2Title: 'Local Browser Storage Model & Realistic Limitations',
    privacyCard2Desc:
      'History and saved passwords are stored in browser-local IndexedDB without requiring an account. Passwords are masked (••••••••) in the UI and excluded from console logs, but anyone with direct access to the same unlocked browser profile or device storage can access saved History.',
    privacyCard3Title: 'Update-Safe Persistence',
    privacyCard3Desc:
      'PWA Service Worker updates only refresh static application caches and never erase your IndexedDB Wi-Fi History unless you explicitly clear History or wipe browser site data.',
    btnClearAllStoredData: 'Clear All Stored Data (IndexedDB History & Preferences)',
    confirmWipePrompt: 'Confirm wiping all IndexedDB history and resetting settings?',
    btnConfirmWipe: 'Confirm Wipe',

    // About & Developer Identity Section
    aboutHeading: 'Developer & Creator Profile',
    aboutDescription:
      'ZIP QR — Wi-Fi QR Decoder (PWA) — SCAN. REVEAL. CONNECT. Designed for iPhones, iPads, Android phones & tablets, Windows, MacBooks, and Linux computers. Supports WPA, WPA2, WPA3-SAE, WPA2-EAP, WEP, Open (nopass), hidden networks, escaped special characters (\\; \\, \\: \\\\ \\"), and Wi-Fi Easy Connect (DPP:).',
    creatorSectionBadge: 'Developer & Creator Identity',
    creatorNameLabel: 'Name',
    creatorNameValue: 'Zardasht Muhammad',
    creatorTitleLabel: 'Professional Title',
    creatorTitleValue: 'Developer & Creator',
    creatorProjectLabel: 'Project',
    creatorProjectValue: 'ZIP QR — Wi-Fi QR Decoder',
    creatorCreditLine: 'Created and developed by Zardasht Muhammad.',
    creatorContactBtn: 'Contact via Email',
    creatorEmailLabel: 'Contact Email',

    // Footer & Notifications
    footerLeft: 'ZIP QR — Wi-Fi QR Decoder • SCAN. REVEAL. CONNECT.',
    footerRight: '100% Local In-Browser QR Decoding • Full Offline PWA Support',
    toastPasswordExtracted: 'Password extracted and saved locally for',
    toastDecodedPayload: 'Decoded QR code',
    toastPasswordCopied: 'Wi-Fi Password copied to clipboard!',
    toastSsidCopied: 'SSID copied to clipboard!',
    toastAllCopied: 'All network information copied to clipboard!',
    toastDownloadedTxt: 'Downloaded decoded report (.txt)',
    toastDownloadedJson: 'Downloaded decoded JSON (.json)',
    toastEnterPayload: 'Please enter a QR payload string to decode.',
    toastHistoryEnabled: 'Persistent IndexedDB scan history enabled.',
    toastHistoryPaused: 'Scan history paused.',
    toastHistoryCleared: 'Cleared all records from IndexedDB scan history.',
    toastEntryDeleted: 'Deleted entry from IndexedDB scan history.',
    toastThemeUpdated: 'Theme updated.',
    toastDataWiped: 'All local IndexedDB history and preferences have been cleared.',
    toastLanguageChanged: 'Language switched to English.',
    toastDecodeError: 'Could not decode a valid QR code from this image.',
    toastTorchUnsupported: 'Flashlight control not supported on this camera.',
    toastMultipleQrFound: 'Multiple QR codes detected in image — select one below.',
    toastOfflineReadyConfirmed: 'All essential app files cached — ready for offline use!',
  },
};
