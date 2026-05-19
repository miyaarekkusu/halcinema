import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ─── 定数 ──────────────────────────────────────────────────────────
const ROWS = 10
const COLS = 20
const SPACING_X = 1.5
const SPACING_Z = 2.0
const HEIGHT_STEP = 0.5
const AISLE_WIDTH = 2.5
const PRICE_PER_SEAT = 1800
const TAKEN_RATE = 0.28   // 事前に埋まっている席の割合

const ROW_LABELS = ['A','B','C','D','E','F','G','H','I','J']

const STATE_AVAILABLE = 0
const STATE_SELECTED  = 1
const STATE_TAKEN     = 2

// ─── DOM ──────────────────────────────────────────────────────────
const canvas       = document.querySelector('canvas.webgl')
const canvasWrap   = document.querySelector('.zaseki-canvas-wrap')
const selectedList = document.getElementById('selected-list')
const countEl      = document.getElementById('selected-count')
const totalPriceEl = document.getElementById('total-price')
const confirmBtn   = document.getElementById('confirm-btn')
const viewSection  = document.getElementById('view-section')
const viewBtn      = document.getElementById('view-btn')
const resetViewBtn = document.getElementById('reset-view-btn')
const tooltip      = document.getElementById('zaseki-tooltip')

// ─── サイズ ────────────────────────────────────────────────────────
const sizes = { width: 0, height: 0 }
const updateSizes = () => {
  sizes.width  = canvasWrap.clientWidth
  sizes.height = canvasWrap.clientHeight
}
updateSizes()

// ─── シーン ────────────────────────────────────────────────────────
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0D0F14)
scene.fog = new THREE.FogExp2(0x0D0F14, 0.018)

// ─── ライト ────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.5))

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
dirLight.position.set(0, 12, 5)
scene.add(dirLight)

// スクリーンからのブルー光
const screenLight = new THREE.PointLight(0x3355cc, 1.2, 35)
screenLight.position.set(0, 10, -8)
scene.add(screenLight)

// ─── マテリアル ────────────────────────────────────────────────────
const matAvailable = new THREE.MeshStandardMaterial({ color: 0x6a7090 })
const matSelected  = new THREE.MeshStandardMaterial({ color: 0xE8212B, emissive: 0x8a0000, emissiveIntensity: 0.3 })
const matTaken     = new THREE.MeshStandardMaterial({ color: 0x252A3A })
const matFloor     = new THREE.MeshStandardMaterial({ color: 0x0a0c12 })

function getMat(state) {
  return [matAvailable, matSelected, matTaken][state]
}

// ─── 座席生成 ──────────────────────────────────────────────────────
function createSeatGroup(row, col, state) {
  const group = new THREE.Group()
  const mat   = getMat(state)

  // 座面
  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), mat)
  base.position.y = 0.5
  group.add(base)

  // 背もたれ
  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), mat)
  back.position.set(0, 1, 0.4)
  group.add(back)

  // 左肘掛け
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 1), mat)
  leftArm.position.set(-0.55, 0.7, 0)
  group.add(leftArm)

  // 右肘掛け
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 1), mat)
  rightArm.position.set(0.55, 0.7, 0)
  group.add(rightArm)

  group.userData.row   = row
  group.userData.col   = col
  group.userData.state = state
  group.userData.label = `${ROW_LABELS[row]}-${col + 1}`

  return group
}

// ─── 座席配置 ──────────────────────────────────────────────────────
const seatObjects  = []   // { row, col, state, group, label }
const clickableGroups = []

const totalWidth = ((COLS - 1) * SPACING_X) + AISLE_WIDTH * 2

// ランダムシードで再現性を持たせたい場合は固定 seed を使う
// （ここでは単純に Math.random）
const takenSet = new Set()
while (takenSet.size < Math.floor(ROWS * COLS * TAKEN_RATE)) {
  takenSet.add(Math.floor(Math.random() * ROWS * COLS))
}

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const idx   = row * COLS + col
    const state = takenSet.has(idx) ? STATE_TAKEN : STATE_AVAILABLE

    const group = createSeatGroup(row, col, state)

    let offsetX = 0
    if (col >= 5 && col < 15) offsetX = AISLE_WIDTH
    else if (col >= 15)        offsetX = AISLE_WIDTH * 2

    group.position.x = col * SPACING_X + offsetX - totalWidth / 2
    group.position.z = row * SPACING_Z
    group.position.y = row * HEIGHT_STEP

    scene.add(group)

    const obj = { row, col, state, group, label: group.userData.label }
    seatObjects.push(obj)
    if (state !== STATE_TAKEN) clickableGroups.push(group)
  }
}

// ─── スクリーン ────────────────────────────────────────────────────
const screenMat = new THREE.MeshBasicMaterial({ color: 0x1a2244 })
const screenEdge = new THREE.MeshBasicMaterial({ color: 0x3355aa })

const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), screenMat)
screenMesh.position.set(0, 9, -9)
scene.add(screenMesh)

// スクリーン枠
const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1d2a })
const frame = new THREE.Mesh(new THREE.BoxGeometry(25.2, 11.2, 0.15), frameMat)
frame.position.set(0, 9, -9.1)
scene.add(frame)

// スクリーン上部のサイン
const signGeom = new THREE.BoxGeometry(26, 0.4, 0.1)
const signMat  = new THREE.MeshStandardMaterial({ color: 0x252A3A })
const sign = new THREE.Mesh(signGeom, signMat)
sign.position.set(0, 14.5, -9)
scene.add(sign)

// ─── 床 ───────────────────────────────────────────────────────────
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  matFloor
)
floor.rotation.x = -Math.PI / 2
floor.position.set(0, 0, 8)
scene.add(floor)

// ─── カメラ ────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 200)

const DEFAULT_CAM_POS    = new THREE.Vector3(0, 18, 38)
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 5, 8)

camera.position.copy(DEFAULT_CAM_POS)
scene.add(camera)

// ─── OrbitControls ─────────────────────────────────────────────────
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.target.copy(DEFAULT_CAM_TARGET)
controls.minDistance = 3
controls.maxDistance = 80
controls.maxPolarAngle = Math.PI * 0.85

// ─── Renderer ─────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// ─── リサイズ ──────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  updateSizes()
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// ─── 座席の状態変更 ────────────────────────────────────────────────
function setSeatState(seatObj, newState) {
  seatObj.state             = newState
  seatObj.group.userData.state = newState
  const mat = getMat(newState)
  seatObj.group.traverse(child => {
    if (child.isMesh) child.material = mat
  })
}

// ─── Raycaster ────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster()
const mouse     = new THREE.Vector2()

function getCanvasMouse(event) {
  const rect = canvas.getBoundingClientRect()
  mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1
  mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1
}

function findSeatGroup(intersects) {
  for (const hit of intersects) {
    let obj = hit.object
    while (obj && !obj.userData.hasOwnProperty('row')) {
      obj = obj.parent
    }
    if (obj && obj.userData.hasOwnProperty('row')) return obj
  }
  return null
}

// ─── クリック → 選択 ───────────────────────────────────────────────
let lastSelected = null   // 直近に選択した座席（視点移動ボタン用）

canvas.addEventListener('click', (e) => {
  getCanvasMouse(e)
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(clickableGroups, true)
  const group = findSeatGroup(hits)
  if (!group) return

  const seatObj = seatObjects.find(s => s.group === group)
  if (!seatObj || seatObj.state === STATE_TAKEN) return

  if (seatObj.state === STATE_AVAILABLE) {
    setSeatState(seatObj, STATE_SELECTED)
    lastSelected = seatObj
  } else {
    setSeatState(seatObj, STATE_AVAILABLE)
    lastSelected = seatObjects.find(s => s.state === STATE_SELECTED) ?? null
  }
  updateUI()
})

// ─── ホバー → ツールチップ ─────────────────────────────────────────
canvas.addEventListener('mousemove', (e) => {
  getCanvasMouse(e)
  raycaster.setFromCamera(mouse, camera)
  const hits = raycaster.intersectObjects(clickableGroups, true)
  const group = findSeatGroup(hits)

  if (group) {
    canvas.style.cursor = group.userData.state === STATE_TAKEN ? 'not-allowed' : 'pointer'
    tooltip.textContent = group.userData.state === STATE_TAKEN
      ? `${group.userData.label}（満席）`
      : `${group.userData.label}`
    tooltip.style.left = `${e.clientX - canvasWrap.getBoundingClientRect().left}px`
    tooltip.style.top  = `${e.clientY - canvasWrap.getBoundingClientRect().top}px`
    tooltip.classList.add('visible')
  } else {
    canvas.style.cursor = 'default'
    tooltip.classList.remove('visible')
  }
})

canvas.addEventListener('mouseleave', () => {
  tooltip.classList.remove('visible')
})

// ─── カメラアニメーション ──────────────────────────────────────────
const camAnim = {
  active:   false,
  targetPos: new THREE.Vector3(),
  targetAt:  new THREE.Vector3()
}

controls.addEventListener('start', () => { camAnim.active = false })

function moveCameraTo(pos, lookAt) {
  camAnim.targetPos.copy(pos)
  camAnim.targetAt.copy(lookAt)
  camAnim.active = true
}

// 視点移動ボタン
viewBtn.addEventListener('click', () => {
  if (!lastSelected) return
  const p = lastSelected.group.position
  moveCameraTo(
    new THREE.Vector3(p.x, p.y + 2, p.z + 1),
    new THREE.Vector3(0, 9, -9)
  )
})

// 全体表示に戻す
resetViewBtn.addEventListener('click', () => {
  moveCameraTo(DEFAULT_CAM_POS.clone(), DEFAULT_CAM_TARGET.clone())
})

// ─── UI更新 ────────────────────────────────────────────────────────
function updateUI() {
  const selected = seatObjects.filter(s => s.state === STATE_SELECTED)
  const count    = selected.length

  countEl.textContent    = count
  totalPriceEl.textContent = (count * PRICE_PER_SEAT).toLocaleString()
  confirmBtn.disabled    = count === 0

  if (count === 0) {
    selectedList.innerHTML = '<p class="zaseki-empty-msg">座席をクリックして選択してください</p>'
  } else {
    selectedList.innerHTML = selected.map(s =>
      `<span class="zaseki-seat-tag" data-label="${s.label}">${s.label}</span>`
    ).join('')

    // タグクリックで選択解除
    selectedList.querySelectorAll('.zaseki-seat-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const lbl = tag.dataset.label
        const seatObj = seatObjects.find(s => s.label === lbl)
        if (seatObj) {
          setSeatState(seatObj, STATE_AVAILABLE)
          lastSelected = seatObjects.find(s => s.state === STATE_SELECTED) ?? null
          updateUI()
        }
      })
    })
  }

  // 視点移動ボタン表示制御
  viewSection.style.display = count > 0 ? 'flex' : 'none'
  if (!lastSelected) {
    lastSelected = selected[selected.length - 1] ?? null
  }
}

// 確定ボタン
confirmBtn.addEventListener('click', () => {
  const selected = seatObjects.filter(s => s.state === STATE_SELECTED)
  const labels   = selected.map(s => s.label).join(', ')
  const total    = (selected.length * PRICE_PER_SEAT).toLocaleString()
  alert(`予約内容\n座席：${labels}\n合計：¥${total}\n\n※ この画面は開発中です。`)
})

// ─── アニメーションループ ──────────────────────────────────────────
const tick = () => {
  if (camAnim.active) {
    camera.position.lerp(camAnim.targetPos, 0.07)
    controls.target.lerp(camAnim.targetAt, 0.07)

    if (
      camera.position.distanceTo(camAnim.targetPos) < 0.05 &&
      controls.target.distanceTo(camAnim.targetAt) < 0.05
    ) {
      camera.position.copy(camAnim.targetPos)
      controls.target.copy(camAnim.targetAt)
      camAnim.active = false
    }
  }

  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

tick()
