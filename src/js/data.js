'use strict';
/* Eclyra — oyun içeriği: bölgeler, düşmanlar, boss'lar, eşyalar, büyüler, hikâye */

// Bölüm başına güç çarpanı (düşmanlar ve eşyalar aynı eğriyi izler)
E.scale = fl => 1 + 0.32 * (fl - 1) + 0.011 * (fl - 1) * (fl - 1);
E.itemScale = lv => 1 + 0.30 * (lv - 1) + 0.010 * (lv - 1) * (lv - 1);

// ---------------- BÖLGELER (her biri 10 bölüm) ----------------
E.BIOMES = [
  {
    id: 'bambu', name: 'Bambu Ormanı', floor: ['#3d5a2f', '#456735', '#36502a'], wall: '#1f3a1d', wallTop: '#2c4f26', wallFace: '#173016',
    accent: '#8fd16a', dark: 0.42, light: '#ffe2a8', fx: 'leaves', deco: ['grass', 'bamboo', 'rock', 'lantern', 'flower'],
    enemies: ['slime', 'bat', 'charger', 'archer'], music: 0,
    names: { slime: 'Orman Balçığı', bat: 'Gece Yarasası', charger: 'Yaban Domuzu', archer: 'Tengu Okçu' },
    colors: { slime: '#7ccf5a', bat: '#5b4a6e', charger: '#8a5a3a', archer: '#c64b3d' }
  },
  {
    id: 'tapinak', name: 'Batık Tapınak', floor: ['#3b5566', '#41606f', '#35505e'], wall: '#1d3140', wallTop: '#2a4558', wallFace: '#16262f',
    accent: '#5fd3e8', dark: 0.5, light: '#9fe8ff', fx: 'bubbles', deco: ['puddle', 'pillar', 'coral', 'rock', 'lantern'],
    enemies: ['slime', 'chaser', 'caster', 'tank'], music: 1,
    names: { slime: 'Su Balçığı', chaser: 'Kappa', caster: 'Balık Ruhu', tank: 'Taş Yengeç' },
    colors: { slime: '#57b9e0', chaser: '#4f9a5a', caster: '#79d6ff', tank: '#b4553e' }
  },
  {
    id: 'katedral', name: 'Kızıl Katedral', floor: ['#4a4a55', '#52525e', '#43434d'], wall: '#26232c', wallTop: '#36313e', wallFace: '#1b1920',
    accent: '#ff4fa8', dark: 0.58, light: '#ff8fd0', fx: 'rain', deco: ['grass', 'grass', 'circle', 'pinkfire', 'statue', 'rubble'],
    enemies: ['chaser', 'bat', 'caster', 'turret'], music: 2,
    names: { chaser: 'İskelet Şövalye', bat: 'Kan Yarasası', caster: 'Hayalet Rahibe', turret: 'Gargoyl' },
    colors: { chaser: '#d8d2c0', bat: '#a32a3a', caster: '#c99cff', turret: '#6c6875' }
  },
  {
    id: 'mantar', name: 'Mantar Mağarası', floor: ['#3a3048', '#413552', '#342b41'], wall: '#1c1626', wallTop: '#2b2238', wallFace: '#14101c',
    accent: '#5effc8', dark: 0.62, light: '#7dffd8', fx: 'spores', deco: ['mushroom', 'crystal', 'rock', 'glow', 'grass'],
    enemies: ['slime', 'bomber', 'bat', 'turret'], music: 1,
    names: { slime: 'Spor Balçığı', bomber: 'Patlak Mantar', bat: 'Ateşböceği', turret: 'Mantar Kule' },
    colors: { slime: '#b36cff', bomber: '#ff6f61', bat: '#e9ff6b', turret: '#5effc8' }
  },
  {
    id: 'kor', name: 'Kor Vadisi', floor: ['#4a2f2a', '#55342c', '#3f2824'], wall: '#241514', wallTop: '#3a201b', wallFace: '#170d0c',
    accent: '#ff8a2b', dark: 0.48, light: '#ffb070', fx: 'embers', deco: ['lava', 'rock', 'bones', 'brazier', 'rubble'],
    enemies: ['slime', 'caster', 'charger', 'bomber'], music: 2,
    names: { slime: 'Magma Balçığı', caster: 'Kor İmp', charger: 'Lav Köpeği', bomber: 'Kıvılcım Ruhu' },
    colors: { slime: '#ff7a2b', caster: '#ff4d3d', charger: '#3a2a2a', bomber: '#ffd23b' }
  },
  {
    id: 'buz', name: 'Buzul Mabet', floor: ['#8fb1c9', '#9bbdd4', '#86a8c0'], wall: '#3e5d78', wallTop: '#56789a', wallFace: '#2c4459',
    accent: '#d4f3ff', dark: 0.35, light: '#e2f7ff', fx: 'snow', deco: ['ice', 'pillar', 'rock', 'lantern', 'snowpile'],
    enemies: ['charger', 'caster', 'bat', 'tank'], music: 3,
    names: { charger: 'Kar Kurdu', caster: 'Buz Büyücüsü', bat: 'Kar Ruhu', tank: 'Buz Golemi' },
    colors: { charger: '#e9f2f7', caster: '#7ec8ff', bat: '#cfefff', tank: '#9cd8f0' }
  },
  {
    id: 'kemik', name: 'Kemik Bahçesi', floor: ['#4b4f3e', '#535846', '#434737'], wall: '#262820', wallTop: '#363a2d', wallFace: '#1b1c16',
    accent: '#c6ff6e', dark: 0.6, light: '#d8ffa0', fx: 'wisps', deco: ['bones', 'grave', 'grass', 'statue', 'rubble'],
    enemies: ['chaser', 'archer', 'bat', 'turret'], music: 2,
    names: { chaser: 'İskelet Savaşçı', archer: 'İskelet Okçu', bat: 'Uçan Kafatası', turret: 'Ruh Feneri' },
    colors: { chaser: '#e3dcc6', archer: '#cfc6ad', bat: '#f2ecd8', turret: '#b6ff5e' }
  },
  {
    id: 'kristal', name: 'Kristal Derinlik', floor: ['#2e3550', '#343c5a', '#293047'], wall: '#151a2e', wallTop: '#232a47', wallFace: '#0e1221',
    accent: '#ff7bf2', dark: 0.55, light: '#b9a8ff', fx: 'sparkles', deco: ['crystal', 'glow', 'rock', 'pillar', 'circle'],
    enemies: ['chaser', 'turret', 'caster', 'slime'], music: 3,
    names: { chaser: 'Kristal Böcek', turret: 'Prizma', caster: 'Işık Ruhu', slime: 'Kristal Balçık' },
    colors: { chaser: '#7ef3ff', turret: '#ff7bf2', caster: '#fff2a8', slime: '#b48bff' }
  },
  {
    id: 'golge', name: 'Gölge Saray', floor: ['#2a2430', '#302937', '#25202a'], wall: '#120f16', wallTop: '#1f1a26', wallFace: '#0b090e',
    accent: '#ffcf5a', dark: 0.66, light: '#ffd98a', fx: 'ash', deco: ['pillar', 'statue', 'lantern', 'carpet', 'rubble'],
    enemies: ['charger', 'archer', 'caster', 'tank'], music: 2,
    names: { charger: 'Gölge Ninja', archer: 'Gölge Okçu', caster: 'Kara Ruh', tank: 'Gölge Muhafız' },
    colors: { charger: '#2b2633', archer: '#3b3346', caster: '#7c4dff', tank: '#4a3f58' }
  },
  {
    id: 'kalp', name: 'Eclyra\'nın Kalbi', floor: ['#1e1a2e', '#241f38', '#1a1628'], wall: '#0a0812', wallTop: '#17122a', wallFace: '#06050b',
    accent: '#e6d8ff', dark: 0.6, light: '#d9c8ff', fx: 'void', deco: ['circle', 'crystal', 'glow', 'pillar', 'rubble'],
    enemies: ['chaser', 'caster', 'charger', 'turret', 'bomber', 'bat'], music: 4,
    names: { chaser: 'Hiçlik Yaratığı', caster: 'Boş Göz', charger: 'Hiçlik Tazısı', turret: 'Kara Monolit', bomber: 'Kararan Yıldız', bat: 'Gölge Kanat' },
    colors: { chaser: '#6b5aa8', caster: '#e6d8ff', charger: '#3a2f63', turret: '#120f20', bomber: '#b48bff', bat: '#4b3d80' }
  }
];
E.biomeOf = fl => E.BIOMES[Math.min(9, Math.floor((fl - 1) / 10))];

// ---------------- DÜŞMAN TİPLERİ ----------------
// hp/dmg temel değerler E.scale(bölüm) ile çarpılır
E.ENEMIES = {
  slime:   { hp: 34, dmg: 9,  speed: 26, r: 6, xp: 5, gold: 2, size: 14 },
  bat:     { hp: 18, dmg: 7,  speed: 52, r: 5, xp: 4, gold: 2, size: 14, fly: true },
  chaser:  { hp: 48, dmg: 12, speed: 34, r: 6, xp: 7, gold: 3, size: 18 },
  charger: { hp: 44, dmg: 15, speed: 30, r: 7, xp: 7, gold: 3, size: 18 },
  archer:  { hp: 30, dmg: 10, speed: 30, r: 6, xp: 7, gold: 3, size: 18 },
  caster:  { hp: 34, dmg: 10, speed: 24, r: 6, xp: 8, gold: 4, size: 18 },
  bomber:  { hp: 26, dmg: 22, speed: 44, r: 6, xp: 6, gold: 3, size: 14 },
  turret:  { hp: 70, dmg: 9,  speed: 0,  r: 8, xp: 9, gold: 4, size: 20, fixed: true },
  tank:    { hp: 110, dmg: 16, speed: 20, r: 9, xp: 12, gold: 6, size: 24 }
};

// ---------------- BOSS'LAR ----------------
E.BOSSES = [
  { name: 'Buru', title: 'Bambu Ormanının Yaban Kralı', kind: 'boar', color: '#7a4a2e', hp: 820, dmg: 16, r: 16, size: 44,
    intro: 'Yeşilin arasından toprağı titreten bir homurtu yükseldi…' },
  { name: 'Mizuchi', title: 'Batık Tapınağın Bekçisi', kind: 'serpent', color: '#2f8fb0', hp: 900, dmg: 17, r: 16, size: 46,
    intro: 'Sular çekildi; dev bir yılan halka halka belirdi.' },
  { name: 'Garm', title: 'Kızıl Yağmurun Kurdu', kind: 'wolf', color: '#4a1a1e', hp: 980, dmg: 19, r: 17, size: 48,
    intro: 'Yağmur kızıla döndü. Heykellerin arasında bir uluma…' },
  { name: 'Spor Ana', title: 'Mantar Mağarasının Kalbi', kind: 'mother', color: '#9a4dff', hp: 1050, dmg: 17, r: 18, size: 48, fixed: true,
    intro: 'Mağara nefes aldı. Duvarlardaki ışıklar bir kalp gibi atıyor.' },
  { name: 'Kagutsu', title: 'Kor Vadisinin Ateş Devi', kind: 'oni', color: '#c4352a', hp: 1150, dmg: 22, r: 17, size: 50,
    intro: 'Lav köpürdü. Boynuzlu bir dev ateşin içinden yürüdü.' },
  { name: 'Sayo', title: 'Buzul Mabedin Hanımı', kind: 'yuki', color: '#cfefff', hp: 1150, dmg: 20, r: 13, size: 42,
    intro: 'Rüzgâr durdu. Karın içinden beyaz bir kadın süzüldü.' },
  { name: 'Kemik Dev', title: 'Kemik Bahçesinin Uykusuz Devi', kind: 'giant', color: '#e8e0c8', hp: 1300, dmg: 24, r: 20, size: 56,
    intro: 'Mezarlar yarıldı. Yüz kemikten bir dev ayağa kalktı.' },
  { name: 'Aynacı', title: 'Işığın Kırık Aynası', kind: 'golem', color: '#7ef3ff', hp: 1350, dmg: 22, r: 18, size: 52,
    intro: 'Kristaller birleşti; ışığı büken dev bir golem uyandı.' },
  { name: 'Kage', title: 'Düşmüş Mühürdar', kind: 'samurai', color: '#2b2633', hp: 1400, dmg: 26, r: 12, size: 40,
    intro: 'Gölgeler eğildi. "Ben de bir zamanlar senin gibiydim, çocuk."' },
  { name: 'Boş Kral', title: 'Eclyra\'nın Gölgesi', kind: 'void', color: '#e6d8ff', hp: 1800, dmg: 28, r: 20, size: 60,
    intro: 'Hiçlik konuştu: "Yüz basamak indin. Şimdi ışığı söndürme zamanı."' }
];

// ---------------- EŞYALAR ----------------
E.RARITY = [
  { name: 'Sıradan', color: '#c8c8c8', mult: 1.0, affixes: [0, 1], weight: 64 },
  { name: 'Nadir', color: '#5aa9ff', mult: 1.22, affixes: [2, 2], weight: 26 },
  { name: 'Destansı', color: '#c27bff', mult: 1.5, affixes: [3, 3], weight: 8.5 },
  { name: 'Efsanevi', color: '#ffa53b', mult: 1.85, affixes: [4, 4], weight: 1.5 }
];

E.SLOTS = ['silah', 'migfer', 'zirh', 'eldiven', 'cizme', 'tilsim', 'yuzuk'];
E.SLOT_NAME = { silah: 'Kılıç', migfer: 'Miğfer', zirh: 'Zırh', eldiven: 'Eldiven', cizme: 'Çizme', tilsim: 'Tılsım', yuzuk: 'Yüzük' };
// Ana statlar (bölüm ölçeğiyle çarpılır)
E.SLOT_BASE = {
  silah:   { dmg: 8 },
  migfer:  { hp: 10, def: 2 },
  zirh:    { hp: 18, def: 4 },
  eldiven: { dmg: 1.6, crit: 0.03 },
  cizme:   { def: 2, move: 0.05 },
  tilsim:  { spell: 5, mana: 10 },
  yuzuk:   { dmg: 1.2, critDmg: 0.15 }
};
// İsim parçaları
E.ITEM_NAMES = {
  silah: ['Katana', 'Tachi', 'Wakizashi', 'Nodachi', 'Ay Kılıcı', 'Bambu Kılıç', 'Kor Kılıç', 'Kırağı Kılıcı'],
  migfer: ['Kabuto', 'Hasır Şapka', 'Demir Miğfer', 'Oni Maskesi', 'Tilki Maskesi'],
  zirh: ['Do Zırhı', 'Deri Yelek', 'Pul Zırh', 'Keşiş Cübbesi', 'Ronin Haorisi'],
  eldiven: ['Kote', 'Deri Eldiven', 'Pençe Eldiven', 'İpek Sargı'],
  cizme: ['Waraji', 'Tabi', 'Sune-ate', 'Rüzgâr Çizmesi'],
  tilsim: ['Omamori', 'Ay Muskası', 'Kristal Kolye', 'Ruh Fenerciği'],
  yuzuk: ['Gümüş Yüzük', 'Ay Taşı Yüzük', 'Kemik Halka', 'Yılan Yüzüğü']
};
E.PREFIX = ['Paslı', 'Sağlam', 'Keskin', 'Kadim', 'Kutsal', 'Lanetli', 'Fırtına', 'Gece', 'Şafak', 'Ejder', 'Tilki', 'Ay'];

// Ek özellikler: [anahtar, ad, min, max, ölçekli mi]
E.AFFIXES = [
  ['hp', 'Can', 5, 9, true],
  ['dmg', 'Hasar', 1.0, 2.0, true],
  ['def', 'Savunma', 1.0, 2.2, true],
  ['crit', 'Kritik şansı', 0.02, 0.06, false],
  ['critDmg', 'Kritik hasarı', 0.10, 0.30, false],
  ['atkSpd', 'Saldırı hızı', 0.04, 0.10, false],
  ['move', 'Hareket hızı', 0.03, 0.07, false],
  ['mana', 'Mana', 6, 18, false],
  ['manaRegen', 'Mana yenilenmesi', 0.6, 2.0, false],
  ['lifesteal', 'Can çalma', 0.01, 0.03, false],
  ['spell', 'Büyü gücü', 2.0, 4.0, true],
  ['goldFind', 'Altın bulma', 0.06, 0.20, false],
  ['magicFind', 'Eşya bulma', 0.05, 0.15, false],
  ['cdr', 'Bekleme azaltma', 0.03, 0.08, false]
];
E.STAT_NAME = Object.fromEntries(E.AFFIXES.map(a => [a[0], a[1]]));
E.PCT_STATS = new Set(['crit', 'critDmg', 'atkSpd', 'move', 'lifesteal', 'goldFind', 'magicFind', 'cdr']);

// Efsanevi yetenekler
E.PERKS = {
  ates_izi: { name: 'Ateş İzi', desc: 'Atılırken arkanda yakıcı alev bırakırsın.' },
  kan_emici: { name: 'Kan Emici', desc: 'Öldürdüğün her düşman canının %4\'ünü geri verir.' },
  yanki: { name: 'Yankı', desc: 'Her 3. kılıç vuruşu bir şok dalgası yayar.' },
  ay_isigi: { name: 'Ay Işığı', desc: 'Kritik vuruşlar 4 mana yeniler.' },
  gok_gurultusu: { name: 'Gök Gürültüsü', desc: 'Vuruşların %15 ihtimalle yıldırım zinciri başlatır.' },
  diken: { name: 'Diken Kabuğu', desc: 'Aldığın hasarın %30\'u saldırana geri döner.' },
  cift_kesik: { name: 'Çift Kesik', desc: 'Kılıç savurmaların ileri doğru bir hilal dalgası fırlatır.' },
  buz_kalbi: { name: 'Buz Kalbi', desc: 'Canın %30\'un altına inince çevreni dondurursun (20 sn bekleme).' }
};

// ---------------- BÜYÜLER ----------------
E.SPELLS = [
  { id: 'ates', name: 'Ateş Topu', key: '1', mana: 10, cd: 0.45, color: '#ff8a2b', unlock: 0, desc: 'İleri doğru patlayan bir ateş topu fırlatır.' },
  { id: 'buz', name: 'Buz Halkası', key: '2', mana: 24, cd: 4.0, color: '#8fe3ff', unlock: 1, desc: 'Çevrendeki düşmanlara hasar verip yavaşlatır.' },
  { id: 'yildirim', name: 'Yıldırım Zinciri', key: '3', mana: 28, cd: 2.6, color: '#fff36b', unlock: 3, desc: 'En yakın düşmandan başlayıp sekerek yayılır.' },
  { id: 'ay', name: 'Ay Kalkanı', key: '4', mana: 35, cd: 12, color: '#d9c8ff', unlock: 6, desc: 'Hasarı emen bir kalkan ve kısa süreli hız verir.' }
];

// ---------------- HİKÂYE ----------------
E.STORY = {
  intro: [
    'Yüz yıl önce Ay Tanrıçası Eclyra, Kiri Köyü\'nün altındaki kuyuya Hiçlik\'i mühürledi.',
    'Yüz basamaklı Derinlik\'in her onuncu katına bir Mühürdar yerleştirdi.',
    'Bu gece yağmur kırmızı yağdı. Kuyudan uğultular yükseldi.',
    'Mühürdarlar Hiçlik\'e yenik düştü. Mühürler bir bir çatlıyor.',
    'Sen Aren\'sin; tapınağın son kılıç öğrencisi.',
    'Bilge Nene seni tapınakta bekliyor.'
  ],
  // Nene'nin konuşmaları: boss sayısına göre
  nene: [
    ['Aren, geldin. Kuyunun sesini sen de duydun, değil mi?', 'Derinlik yüz basamak. Her onuncu basamakta yozlaşmış bir Mühürdar var.', 'Onları yenersen Ay Parçalarını geri alırsın. On parça… Eclyra\'yı uyandırmaya yeter.', 'Sana Ateş Topu\'nu öğrettim. Kuyuya git; ilk basamaklar seni bekliyor.'],
    ['Buru düştü! Ormanın ruhu sana minnettar.', 'Ay Parçası sana Buz Halkası\'nı açtı. Kalabalıklarda işine yarar.', 'Batık Tapınak\'ta sular derin. Dikkatli ol.'],
    ['Mizuchi artık huzur içinde. İki parça…', 'Kızıl Katedral\'de yağmur hiç dinmez. Orada bir kurt dolaşıyor.'],
    ['Garm\'ın ulumaları sustu. Yıldırım artık senin emrinde.', 'Mantar Mağarası nefes alır, dedikleri doğru. Sporlardan uzak dur.'],
    ['Dört parça! Köyde ışıklar daha parlak yanıyor, fark ettin mi?', 'Kor Vadisi\'nde Kagutsu bekliyor. Ateşine ateşle karşılık verme.'],
    ['Kagutsu\'nun ateşi söndü. Yarı yoldasın, Aren.', 'Buzul Mabet\'in hanımı Sayo… bir zamanlar benim öğrencimdi.'],
    ['Sayo\'yu özgür bıraktın. Teşekkür ederim.', 'Ay Kalkanı artık seni koruyacak. Kemik Bahçesi\'nde ölüler uyumaz.'],
    ['Kemik Dev yeniden toprağa karıştı.', 'Kristal Derinlik ışığı büker. Gördüğün her şeye güvenme.'],
    ['Sekiz parça. Kalbin hissettiği o soğukluk… Hiçlik yakın.', 'Gölge Saray\'da Kage seni bekliyor. O, düşen ilk Mühürdar\'dı.'],
    ['Kage son nefesinde senden af diledi. Onu affettin, biliyorum.', 'Son basamak: Eclyra\'nın Kalbi. Boş Kral orada.', 'Git Aren. Işık seninle.'],
    ['Başardın… Eclyra uyandı. Kuyunun dibinden ay ışığı yükseliyor.', 'Kiri Köyü bir kez daha güvende.', 'Ama Derinlik hâlâ orada. Güçlenmek istersen basamaklar seni bekler.']
  ],
  bossDefeat: [
    'Buru diz çöktü. Ormandan yeşil bir ışık yükseldi.',
    'Mizuchi suya karıştı. Tapınağın çanları yeniden çaldı.',
    'Garm son kez uludu; yağmur dindi.',
    'Spor Ana söndü. Mağara sessizleşti.',
    'Kagutsu\'nun ateşi kül oldu.',
    'Sayo gülümsedi: "Nene\'ye selam söyle."',
    'Kemik Dev dağıldı; bahçede çiçekler açtı.',
    'Aynacı kırıldı. Binlerce ışık tek bir ışınla birleşti.',
    'Kage kılıcını bıraktı: "Mührü… sen tamamla."',
    'Boş Kral eridi. Karanlığın ortasında bir ay doğdu.'
  ],
  ending: [
    'Hiçlik dağıldı ve kuyunun dibinde ay ışığı parladı.',
    'Eclyra gözlerini açtı: "Uzun zamandır bekliyordum, küçük kılıç."',
    '"Mühürleri sen tamamladın. Kiri Köyü yeniden huzura kavuştu."',
    'Aren köye döndüğünde kiraz ağaçları açmıştı.',
    'SON — ama Derinlik hâlâ seni bekliyor.'
  ]
};

E.NPC_LINES = {
  tetsu: ['Kılıcın kör olmuş, çocuk. Getir bakayım.', 'Demir getir, altın getir; gerisini çekicim halleder.', 'Bir Efsanevi kılıç gördüğümde ellerim titrer!'],
  mina: ['Hoş geldin! İksirler taze, sandıklar sürprizli!', 'Kuyudan getirdiğin ganimeti satmak ister misin?', 'Gizemli sandıkta bir keresinde Efsanevi çıkmıştı, yemin ederim!'],
  kuyu: ['Ay Kuyusu. Aşağıdan soğuk bir rüzgâr esiyor.']
};
