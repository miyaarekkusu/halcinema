const goodsData = [
  {
    id: 1,
    name: "赤ずきん ポスター",
    price: 1200,
    category: "goods",
    size: "A3"
  },
  {
    id: 2,
    name: "赤ずきん クリアファイル",
    price: 600,
    category: "goods",
    size: "A4"
  },
  {
    id: 7,
    name: "ポップコーン（塩）",
    price: 450,
    category: "shop",
    size: "M"
  },
  
];

function renderGoods(list) {
  const container = document.querySelector(".goods-list");
  container.innerHTML = "";

  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "goods-card";
    card.innerHTML = `
      <img src="img/goods/${item.id}.jpg">
      <p>${item.name}</p>
      <span class="price">¥${item.price}</span>
      <button class="add-cart" data-id="${item.id}">🛒 カートに追加</button>
    `;
    container.appendChild(card);
  });
}

function filterGoods() {
  let list = [...goodsData];

  const keyword = searchInput.value.toLowerCase();
  const category = categoryFilter.value;
  const size = sizeFilter.value;
  const sort = sortPrice.value;

  // Search
  list = list.filter(item => item.name.toLowerCase().includes(keyword));

  // Category
  if (category !== "all") {
    list = list.filter(item => item.category === category);
  }

  // Size
  if (size !== "all") {
    list = list.filter(item => item.size === size);
  }

  // Sort
  if (sort === "asc") list.sort((a, b) => a.price - b.price);
  if (sort === "desc") list.sort((a, b) => b.price - a.price);

  renderGoods(list);
}

searchInput.addEventListener("input", filterGoods);
categoryFilter.addEventListener("change", filterGoods);
sizeFilter.addEventListener("change", filterGoods);
sortPrice.addEventListener("change", filterGoods);

// Initial render
renderGoods(goodsData);

// Add to cart
document.addEventListener("click", e => {
  if (e.target.classList.contains("add-cart")) {
    const id = e.target.dataset.id;
    alert("商品 " + id + " をカートに追加しました！");
  }
});
