// ── モード検出 ─────────────────────────────────────────────────
const IS_BOOKING = !!sessionStorage.getItem('reservationData');
if (IS_BOOKING) document.body.classList.add('booking-mode');

// ── 商品データ ─────────────────────────────────────────────────
const allItems = [
  // GOODS
  { id: 1,  category: 'goods', name: '赤ずきん ポスター',              price: 1200, desc: '映画「赤ずきん」の公式ポスターです。',       size: 'A3',  img: '../images/event1.png' },
  { id: 2,  category: 'goods', name: '赤ずきん クリアファイル',        price: 600,  desc: 'キャラクターデザインのクリアファイル。',     size: 'A4',  img: '../images/event2.png' },
  { id: 3,  category: 'goods', name: '赤ずきん 缶バッジセット',        price: 800,  desc: '限定デザインの缶バッジ3個セット。',         size: null,  img: '../images/event1.png' },
  { id: 4,  category: 'goods', name: 'アリー ポスター',                price: 1200, desc: '映画「アリー」の公式ビジュアルポスター。', size: 'A3',  img: '../images/event2.png' },
  { id: 5,  category: 'goods', name: 'アリー アクリルスタンド',        price: 1500, desc: 'キャラクターのアクリルスタンド。',           size: null,  img: '../images/event1.png' },
  { id: 6,  category: 'goods', name: 'アリー キーホルダー',            price: 700,  desc: '映画ロゴ入りのキーホルダー。',             size: null,  img: '../images/event2.png' },
  { id: 7,  category: 'goods', name: 'アリー ポスター（B版）',        price: 1200, desc: '映画「アリー」の公式ビジュアルポスター。', size: 'A4',  img: '../images/event2.png' },
  { id: 8,  category: 'goods', name: 'アリー アクリルスタンド（大）', price: 2000, desc: 'キャラクターの大型アクリルスタンド。',     size: null,  img: '../images/event1.png' },
  // SHOP
  { id: 9,  category: 'shop', name: 'ポップコーン（塩）',     price: 500, desc: '定番の塩味ポップコーン。',     sizes: ['S（小）', 'M（中）', 'L（大）'], img: '../images/1.png' },
  { id: 10, category: 'shop', name: 'キャラメルポップコーン', price: 600, desc: '甘くて人気のキャラメル味。',   sizes: ['S（小）', 'M（中）', 'L（大）'], img: '../images/1.png' },
  { id: 11, category: 'shop', name: 'ソフトドリンク',         price: 350, desc: 'コーラ・メロンソーダなど。',   sizes: ['S', 'M', 'L'],                   img: '../images/2.png' },
  { id: 12, category: 'shop', name: 'ナチョス',               price: 450, desc: 'チーズソース付きナチョス。',   sizes: ['S（小）', 'L（大）'],             img: '../images/1.png' },
  { id: 13, category: 'shop', name: 'ホットドッグ',           price: 400, desc: '映画といえばホットドッグ。',   sizes: ['1本', '2本セット'],               img: '../images/2.png' },
];

const TITLES = {
  goods: 'グッズ <span>GOODS</span>',
  shop:  '売店 <span>SHOP</span>',
};

// ── 状態 ───────────────────────────────────────────────────────
let cart = {};           // { [id]: { item, qty } }
let currentCategory = 'goods';

// ── DOM ────────────────────────────────────────────────────────
const grid            = document.getElementById('goods-grid');
const searchInput     = document.getElementById('searchInput');
const sizeFilter      = document.getElementById('sizeFilter');
const sortPrice       = document.getElementById('sortPrice');
const itemCount       = document.getElementById('item-count');
const catTitle        = document.getElementById('category-title');
const sizeFilterGroup = document.getElementById('size-filter-group');
const cartPanel       = document.getElementById('cart-panel');
const cartOverlay     = document.getElementById('cart-overlay');
const cartItemsEl     = document.getElementById('cart-items');
const cartTotalEl     = document.getElementById('cart-total');
const cartBadge       = document.getElementById('cart-badge');

// ── 予約情報バー（予約フローのみ） ───────────────────────────
if (IS_BOOKING) {
  const r   = JSON.parse(sessionStorage.getItem('reservationData') || '{}');
  const bar = document.getElementById('gs-booking-bar');
  if (bar && r.movieTitle) {
    bar.innerHTML =
      '<span class="gs-booking-item">' + r.movieTitle + '</span>' +
      (r.screeningInfo ? '<span class="gs-booking-sep">｜</span><span class="gs-booking-item">' + r.screeningInfo + '</span>' : '') +
      (r.seats ? '<span class="gs-booking-sep">｜</span><span class="gs-booking-item">座席：' + r.seats.join('・') + '</span>' : '') +
      '<span class="gs-booking-sep">｜</span><span class="gs-booking-item gs-booking-price">チケット ¥' + (r.totalAmount || 0).toLocaleString() + '</span>';
  }
}

// ── カート描画（右スライドパネル・両モード共通） ──────────────
function renderCart() {
  const entries = Object.values(cart);
  const total   = entries.reduce((s, { item, qty }) => s + item.price * qty, 0);
  const count   = entries.reduce((s, { item, qty }) => s + qty, 0);

  // 予約フローは合計にチケット代を加算
  let displayTotal = total;
  if (IS_BOOKING) {
    const r = JSON.parse(sessionStorage.getItem('reservationData') || '{}');
    displayTotal = total + (r.totalAmount || 0);
  }

  cartTotalEl.textContent = '¥' + displayTotal.toLocaleString();
  cartBadge.textContent   = count;
  cartBadge.classList.toggle('has-items', count > 0);

  if (entries.length === 0) {
    cartItemsEl.innerHTML = '<p class="cart-empty">カートは空です</p>';
    return;
  }

  cartItemsEl.innerHTML = entries.map(({ item, qty }) =>
    '<div class="cart-item">' +
      '<div class="cart-item-info">' +
        '<p class="cart-item-name">' + item.name + '</p>' +
        '<p class="cart-item-price">¥' + item.price.toLocaleString() + ' × ' + qty + '</p>' +
      '</div>' +
      '<div class="cart-item-subtotal">¥' + (item.price * qty).toLocaleString() + '</div>' +
      '<button class="cart-item-remove" data-id="' + item.id + '" title="削除">✕</button>' +
    '</div>'
  ).join('');
}

// ── パネル開閉 ─────────────────────────────────────────────────
function openPanel() {
  cartPanel.classList.add('open');
  cartOverlay.classList.add('open');
}

function closePanel() {
  cartPanel.classList.remove('open');
  cartOverlay.classList.remove('open');
}

// ── 商品グリッド描画 ───────────────────────────────────────────
function renderItems() {
  let list = allItems.filter(i => i.category === currentCategory);

  const keyword = searchInput.value.toLowerCase().trim();
  if (keyword) list = list.filter(i => i.name.toLowerCase().includes(keyword));

  if (currentCategory === 'goods') {
    const size = sizeFilter.value;
    if (size !== 'all') list = list.filter(i => i.size === size);
  }

  const sort = sortPrice.value;
  if (sort === 'asc')  list.sort((a, b) => a.price - b.price);
  if (sort === 'desc') list.sort((a, b) => b.price - a.price);

  itemCount.textContent = list.length + '件';

  if (list.length === 0) {
    grid.innerHTML = '<p class="goods-empty">該当する商品がありません。</p>';
    return;
  }

  grid.innerHTML = list.map(item => {
    const qty = cart[item.id] ? cart[item.id].qty : 0;

    const optionsHtml = item.sizes
      ? '<div class="item-options"><div class="item-option"><label>サイズ</label>' +
        '<select>' + item.sizes.map(s => '<option>' + s + '</option>').join('') + '</select>' +
        '</div></div>'
      : '';

    // 予約フロー：＋－数量コントロール / 単体：カートに追加ボタン
    const footerHtml = IS_BOOKING
      ? '<div class="gs-card-footer">' + (
          qty > 0
            ? '<div class="gs-qty-control">' +
                '<button class="gs-qty-btn" data-action="dec" data-id="' + item.id + '">－</button>' +
                '<span class="gs-qty-num">' + qty + '</span>' +
                '<button class="gs-qty-btn" data-action="inc" data-id="' + item.id + '">＋</button>' +
              '</div>'
            : '<button class="gs-add-btn" data-id="' + item.id + '">カートに追加</button>'
        ) + '</div>'
      : '<div class="item-card-footer"><button class="btn-add-cart" data-id="' + item.id + '">カートに追加</button></div>';

    return '<div class="item-card">' +
      '<img src="' + item.img + '" alt="' + item.name + '">' +
      '<div class="item-info">' +
        '<p class="item-title">' + item.name + '</p>' +
        '<p class="item-price">¥' + item.price.toLocaleString() + '</p>' +
        '<p class="item-desc">' + item.desc + '</p>' +
        optionsHtml +
      '</div>' +
      footerHtml +
    '</div>';
  }).join('');
}

// ── グリッドのイベント委譲 ─────────────────────────────────────
grid.addEventListener('click', function (e) {
  // 予約フロー：gs-add-btn
  const addBtn = e.target.closest('.gs-add-btn');
  if (addBtn) {
    const id   = parseInt(addBtn.dataset.id);
    const item = allItems.find(i => i.id === id);
    if (item) cart[id] = { item, qty: 1 };
    renderItems(); renderCart();
    return;
  }

  // 予約フロー：gs-qty-btn
  const qtyBtn = e.target.closest('.gs-qty-btn');
  if (qtyBtn) {
    const id     = parseInt(qtyBtn.dataset.id);
    const action = qtyBtn.dataset.action;
    if (action === 'inc' && cart[id]) {
      cart[id].qty++;
    } else if (action === 'dec' && cart[id]) {
      cart[id].qty--;
      if (cart[id].qty <= 0) delete cart[id];
    }
    renderItems(); renderCart();
    return;
  }

  // 単体ページ：btn-add-cart
  const cartBtn = e.target.closest('.btn-add-cart');
  if (cartBtn) {
    const id   = parseInt(cartBtn.dataset.id);
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    if (cart[id]) cart[id].qty++;
    else          cart[id] = { item, qty: 1 };
    renderCart();
  }
});

// ── パネル内：削除ボタン ──────────────────────────────────────
cartItemsEl.addEventListener('click', function (e) {
  const btn = e.target.closest('.cart-item-remove');
  if (!btn) return;
  delete cart[parseInt(btn.dataset.id)];
  renderCart();
  renderItems(); // 予約フローの数量コントロールを更新
});

// ── パネル開閉ボタン ───────────────────────────────────────────
document.getElementById('cart-toggle').addEventListener('click', openPanel);
document.getElementById('cart-close').addEventListener('click', closePanel);
cartOverlay.addEventListener('click', closePanel);

// ── 単体ページ：注文ボタン ────────────────────────────────────
const checkoutBtn = document.getElementById('cart-checkout');
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', function () {
    if (Object.keys(cart).length === 0) return;
    alert('注文機能は準備中です。');
  });
}

// ── 予約フロー：決済・スキップボタン ─────────────────────────
const proceedBtn = document.getElementById('proceed-btn');
const skipBtn    = document.getElementById('skip-btn');

if (skipBtn) skipBtn.addEventListener('click', function () {
  sessionStorage.setItem('goodsCart', JSON.stringify([]));
  location.href = 'payment.html';
});

if (proceedBtn) proceedBtn.addEventListener('click', function () {
  const cartArray = Object.values(cart).map(({ item, qty }) => ({
    id: item.id, name: item.name, price: item.price, qty, img: item.img,
  }));
  sessionStorage.setItem('goodsCart', JSON.stringify(cartArray));
  location.href = 'payment.html';
});

// ── カテゴリ切り替え ───────────────────────────────────────────
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentCategory = this.dataset.cat;
    catTitle.innerHTML = TITLES[currentCategory];
    sizeFilterGroup.style.display = currentCategory === 'goods' ? '' : 'none';
    searchInput.value = ''; sizeFilter.value = 'all'; sortPrice.value = 'none';
    renderItems();
  });
});

searchInput.addEventListener('input',  renderItems);
sizeFilter.addEventListener('change',  renderItems);
sortPrice.addEventListener('change',   renderItems);

// ── 初期表示 ───────────────────────────────────────────────────
renderItems();
renderCart();
