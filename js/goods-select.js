// ── 商品データ ──────────────────────────────────────────────
const allItems = [
  // GOODS
  { id: 1,  category: 'goods', name: '赤ずきん ポスター',           price: 1200, desc: '映画「赤ずきん」の公式ポスターです。',         size: 'A3',  img: '../images/event1.png' },
  { id: 2,  category: 'goods', name: '赤ずきん クリアファイル',     price: 600,  desc: 'キャラクターデザインのクリアファイル。',         size: 'A4',  img: '../images/event2.png' },
  { id: 3,  category: 'goods', name: '赤ずきん 缶バッジセット',     price: 800,  desc: '限定デザインの缶バッジ3個セット。',             size: null,  img: '../images/event1.png' },
  { id: 4,  category: 'goods', name: 'アリー ポスター',              price: 1200, desc: '映画「アリー」の公式ビジュアルポスター。',     size: 'A3',  img: '../images/event2.png' },
  { id: 5,  category: 'goods', name: 'アリー アクリルスタンド',     price: 1500, desc: 'キャラクターのアクリルスタンド。',               size: null,  img: '../images/event1.png' },
  { id: 6,  category: 'goods', name: 'アリー キーホルダー',          price: 700,  desc: '映画ロゴ入りのキーホルダー。',                 size: null,  img: '../images/event2.png' },
  { id: 7,  category: 'goods', name: 'アリー ポスター（B版）',      price: 1200, desc: '映画「アリー」の公式ビジュアルポスター。',     size: 'A4',  img: '../images/event2.png' },
  { id: 8,  category: 'goods', name: 'アリー アクリルスタンド（大）', price: 2000, desc: 'キャラクターの大型アクリルスタンド。',       size: null,  img: '../images/event1.png' },
  // SHOP
  { id: 9,  category: 'shop', name: 'ポップコーン（塩）',     price: 500, desc: '定番の塩味ポップコーン。',     sizes: ['S（小）', 'M（中）', 'L（大）'], img: '../images/1.png' },
  { id: 10, category: 'shop', name: 'キャラメルポップコーン', price: 600, desc: '甘くて人気のキャラメル味。',   sizes: ['S（小）', 'M（中）', 'L（大）'], img: '../images/1.png' },
  { id: 11, category: 'shop', name: 'ソフトドリンク',         price: 350, desc: 'コーラ・メロンソーダなど。',   sizes: ['S', 'M', 'L'],                   img: '../images/2.png' },
  { id: 12, category: 'shop', name: 'ナチョス',               price: 450, desc: 'チーズソース付きナチョス。',   sizes: ['S（小）', 'L（大）'],             img: '../images/1.png' },
  { id: 13, category: 'shop', name: 'ホットドッグ',           price: 400, desc: '映画といえばホットドッグ。',   sizes: ['1本', '2本セット'],               img: '../images/2.png' },
];

// ── 状態 ────────────────────────────────────────────────────
let cart = {}             // { [itemId]: { item, qty } }
let currentCategory = 'goods'

// ── DOM ─────────────────────────────────────────────────────
const grid            = document.getElementById('goods-grid')
const searchInput     = document.getElementById('searchInput')
const sizeFilter      = document.getElementById('sizeFilter')
const sortPrice       = document.getElementById('sortPrice')
const itemCount       = document.getElementById('item-count')
const catTitle        = document.getElementById('category-title')
const sizeFilterGroup = document.getElementById('size-filter-group')
const cartList        = document.getElementById('cart-items-list')
const cartTotals      = document.getElementById('gs-cart-totals')

const TITLES = {
  goods: 'グッズ <span>GOODS</span>',
  shop:  '売店 <span>SHOP</span>',
}

// ── 予約情報バー ─────────────────────────────────────────────
;(function () {
  const r = JSON.parse(sessionStorage.getItem('reservationData') || '{}')
  const bar = document.getElementById('gs-booking-bar')
  if (!bar) return
  if (!r.movieTitle) { bar.style.display = 'none'; return }
  bar.innerHTML =
    '<span class="gs-booking-item">' + r.movieTitle + '</span>' +
    (r.screeningInfo ? '<span class="gs-booking-sep">｜</span><span class="gs-booking-item">' + r.screeningInfo + '</span>' : '') +
    (r.seats ? '<span class="gs-booking-sep">｜</span><span class="gs-booking-item">座席：' + r.seats.join('・') + '</span>' : '') +
    '<span class="gs-booking-sep">｜</span><span class="gs-booking-item gs-booking-price">チケット ¥' + (r.totalAmount || 0).toLocaleString() + '</span>'
})()

// ── カート計算 ───────────────────────────────────────────────
function getGoodsTotal() {
  return Object.values(cart).reduce((s, { item, qty }) => s + item.price * qty, 0)
}

// ── カート描画 ───────────────────────────────────────────────
function renderCart() {
  const r = JSON.parse(sessionStorage.getItem('reservationData') || '{}')
  const ticketAmount = r.totalAmount || 0
  const entries = Object.values(cart)

  if (entries.length === 0) {
    cartList.innerHTML = '<p class="gs-cart-empty">商品が選択されていません</p>'
    cartTotals.innerHTML = ''
    cartTotals.style.display = 'none'
    return
  }

  cartList.innerHTML = entries.map(({ item, qty }) =>
    '<div class="gs-cart-item">' +
      '<span class="gs-cart-name">' + item.name + '</span>' +
      '<span class="gs-cart-qty">×' + qty + '</span>' +
      '<span class="gs-cart-price">¥' + (item.price * qty).toLocaleString() + '</span>' +
    '</div>'
  ).join('')

  const goodsSubtotal = getGoodsTotal()
  const grandTotal    = ticketAmount + goodsSubtotal
  cartTotals.style.display = ''
  cartTotals.innerHTML =
    '<div class="gs-total-row"><span>グッズ小計</span><span>¥' + goodsSubtotal.toLocaleString() + '</span></div>' +
    '<div class="gs-total-row"><span>チケット代</span><span>¥' + ticketAmount.toLocaleString() + '</span></div>' +
    '<div class="gs-total-row gs-grand-total"><span>合計</span><span>¥' + grandTotal.toLocaleString() + '</span></div>'
}

// ── 商品グリッド描画 ─────────────────────────────────────────
function renderItems() {
  let list = allItems.filter(i => i.category === currentCategory)

  const keyword = searchInput.value.toLowerCase().trim()
  if (keyword) list = list.filter(i => i.name.toLowerCase().includes(keyword))

  if (currentCategory === 'goods') {
    const size = sizeFilter.value
    if (size !== 'all') list = list.filter(i => i.size === size)
  }

  const sort = sortPrice.value
  if (sort === 'asc')  list.sort((a, b) => a.price - b.price)
  if (sort === 'desc') list.sort((a, b) => b.price - a.price)

  itemCount.textContent = list.length + '件'

  if (list.length === 0) {
    grid.innerHTML = '<p class="goods-empty">該当する商品がありません。</p>'
    return
  }

  grid.innerHTML = list.map(item => {
    const qty = cart[item.id] ? cart[item.id].qty : 0

    const optionsHtml = item.sizes
      ? '<div class="item-options"><div class="item-option"><label>サイズ</label>' +
        '<select>' + item.sizes.map(s => '<option>' + s + '</option>').join('') + '</select>' +
        '</div></div>'
      : ''

    const cartHtml = qty > 0
      ? '<div class="gs-qty-control">' +
          '<button class="gs-qty-btn" data-action="dec" data-id="' + item.id + '">－</button>' +
          '<span class="gs-qty-num">' + qty + '</span>' +
          '<button class="gs-qty-btn" data-action="inc" data-id="' + item.id + '">＋</button>' +
        '</div>'
      : '<button class="gs-add-btn" data-id="' + item.id + '">カートに追加</button>'

    return '<div class="item-card">' +
      '<img src="' + item.img + '" alt="' + item.name + '">' +
      '<div class="item-info">' +
        '<p class="item-title">' + item.name + '</p>' +
        '<p class="item-price">¥' + item.price.toLocaleString() + '</p>' +
        '<p class="item-desc">' + item.desc + '</p>' +
        optionsHtml +
        '<div class="gs-card-footer">' + cartHtml + '</div>' +
      '</div>' +
    '</div>'
  }).join('')
}

// ── グリッドのイベント委譲 ───────────────────────────────────
grid.addEventListener('click', function (e) {
  const addBtn = e.target.closest('.gs-add-btn')
  const qtyBtn = e.target.closest('.gs-qty-btn')

  if (addBtn) {
    const id   = parseInt(addBtn.dataset.id)
    const item = allItems.find(i => i.id === id)
    if (item) { cart[id] = { item, qty: 1 } }
    renderItems(); renderCart()
  }

  if (qtyBtn) {
    const id     = parseInt(qtyBtn.dataset.id)
    const action = qtyBtn.dataset.action
    if (action === 'inc' && cart[id]) {
      cart[id].qty++
    } else if (action === 'dec' && cart[id]) {
      cart[id].qty--
      if (cart[id].qty <= 0) delete cart[id]
    }
    renderItems(); renderCart()
  }
})

// ── カテゴリ切り替え ─────────────────────────────────────────
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'))
    this.classList.add('active')
    currentCategory = this.dataset.cat
    catTitle.innerHTML = TITLES[currentCategory]
    sizeFilterGroup.style.display = currentCategory === 'goods' ? '' : 'none'
    searchInput.value = ''; sizeFilter.value = 'all'; sortPrice.value = 'none'
    renderItems()
  })
})

searchInput.addEventListener('input',  renderItems)
sizeFilter.addEventListener('change',  renderItems)
sortPrice.addEventListener('change',   renderItems)

// ── スキップボタン ───────────────────────────────────────────
document.getElementById('skip-btn').addEventListener('click', function () {
  sessionStorage.setItem('goodsCart', JSON.stringify([]))
  location.href = 'payment.html'
})

// ── 決済へ進むボタン ─────────────────────────────────────────
document.getElementById('proceed-btn').addEventListener('click', function () {
  const cartArray = Object.values(cart).map(({ item, qty }) => ({
    id: item.id, name: item.name, price: item.price, qty: qty, img: item.img
  }))
  sessionStorage.setItem('goodsCart', JSON.stringify(cartArray))
  location.href = 'payment.html'
})

// ── 初期表示 ─────────────────────────────────────────────────
renderItems()
renderCart()
