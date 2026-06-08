import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ─── 定数 ──────────────────────────────────────────────────────────
const ROWS       = 14
const COLS       = 14
const COLS_BACK  = 18
const ROWS_BACK  = 1
// 13行×14列 + 1行×18列 = 182 + 18 = 200席
const SPACING_X  = 1.5
const SPACING_Z  = 2.0
const HEIGHT_STEP = 0.5
const AISLE_WIDTH = 2.5
const PRICE_PER_SEAT = 1800  // ※ 2次開発で券種選択から受け取る予定。現在は未使用。
const TAKEN_RATE = 0.28   // 事前に埋まっている席の割合

const ROW_LABELS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N']

const STATE_AVAILABLE = 0
const STATE_SELECTED  = 1
const STATE_TAKEN     = 2

// ─── DOM ──────────────────────────────────────────────────────────
const canvas       = document.querySelector('canvas.webgl')
const canvasWrap   = document.querySelector('.zaseki-canvas-wrap')
const selectedList = document.getElementById('selected-list')
const countEl      = document.getElementById('selected-count')
// totalPriceEl は料金表示削除のため不使用
const confirmBtn   = document.getElementById('confirm-btn')
const viewSection  = document.getElementById('view-section')
const viewBtn      = document.getElementById('view-btn')
const resetViewBtn = document.getElementById('reset-view-btn')
const tooltip      = document.getElementById('zaseki-tooltip')
const toggle3dBtn  = document.getElementById('toggle-3d')
const toggle2dBtn  = document.getElementById('toggle-2d')
const twoDWrap     = document.getElementById('zaseki-2d-wrap')
const twoDGrid     = document.getElementById('zaseki-2d-grid')

// ─── URLパラメータから上映情報を反映 ─────────────────────────────────
;(function () {
  const p       = new URLSearchParams(location.search)
  const movie   = p.get('movie')
  const format  = p.get('format')
  const screen  = p.get('screen')
  const date    = p.get('date')
  const time    = p.get('time')
  const endtime = p.get('endtime')
  if (!movie && !screen) return

  const nameEl  = document.querySelector('.zaseki-movie-name')
  const titleEl = document.querySelector('.zaseki-movie-title')
  const subEl   = document.querySelector('.zaseki-movie-sub')

  if (movie)  nameEl.textContent  = movie + (format ? '（' + format + '版）' : '')
  if (screen) titleEl.textContent = screen
  const parts = []
  if (date)  parts.push(date)
  if (time)  parts.push(time + (endtime ? '〜' + endtime : ''))
  if (parts.length) subEl.textContent = parts.join(' ／ ')
})()

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
scene.add(new THREE.AmbientLight(0xffffff, 2.0))

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
dirLight.position.set(0, 12, 5)
scene.add(dirLight)

const screenLight = new THREE.PointLight(0x4488ff, 6.0, 50)
screenLight.position.set(0, 8, -6)
scene.add(screenLight)

// ─── マテリアル ────────────────────────────────────────────────────
const matAvailable = new THREE.MeshStandardMaterial({ color: 0x6a7090 })
const matSelected  = new THREE.MeshStandardMaterial({ color: 0xE8212B, emissive: 0x8a0000, emissiveIntensity: 0.3 })
const matTaken     = new THREE.MeshStandardMaterial({ color: 0x252A3A })

function getMat(state) {
  return [matAvailable, matSelected, matTaken][state]
}

// ─── 座席生成 ──────────────────────────────────────────────────────
function createSeatGroup(row, col, state) {
  const group = new THREE.Group()
  const mat   = getMat(state)

  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), mat)
  base.position.y = 0.5
  group.add(base)

  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), mat)
  back.position.set(0, 1, 0.4)
  group.add(back)

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 1), mat)
  leftArm.position.set(-0.55, 0.7, 0)
  group.add(leftArm)

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
const seatObjects     = []
const clickableGroups = []

const normalWidth = (COLS - 1) * SPACING_X + AISLE_WIDTH * 2
const backWidth   = (COLS_BACK - 1) * SPACING_X

for (let row = 0; row < ROWS; row++) {
  const isBack  = row >= ROWS - ROWS_BACK
  const rowCols = isBack ? COLS_BACK : COLS

  for (let col = 0; col < rowCols; col++) {
    const state = Math.random() < TAKEN_RATE ? STATE_TAKEN : STATE_AVAILABLE
    const group = createSeatGroup(row, col, state)

    let offsetX = 0
    if (!isBack) {
      if (col >= 4 && col < 10) offsetX = AISLE_WIDTH
      else if (col >= 10)        offsetX = AISLE_WIDTH * 2
    }

    const centerOffset = isBack ? backWidth / 2 : normalWidth / 2
    group.position.x = col * SPACING_X + offsetX - centerOffset
    group.position.z = row * SPACING_Z
    group.position.y = row * HEIGHT_STEP

    scene.add(group)

    const obj = { row, col, state, group, label: group.userData.label }
    seatObjects.push(obj)
    if (state !== STATE_TAKEN) clickableGroups.push(group)
  }
}

// ─── 出入り口 ──────────────────────────────────────────────────────
const exitMat = new THREE.MeshStandardMaterial({
  color: 0x00cc66, emissive: 0x00cc66, emissiveIntensity: 0.8
})

function createExit(x, z) {
  const group = new THREE.Group()

  const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), exitMat)
  leftPost.position.set(-1.0, 1.75, 0)
  group.add(leftPost)

  const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), exitMat)
  rightPost.position.set(1.0, 1.75, 0)
  group.add(rightPost)

  const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.2), exitMat)
  topBar.position.set(0, 3.5, 0)
  group.add(topBar)

  const light = new THREE.PointLight(0x00cc66, 1.5, 10)
  light.position.set(0, 2, 1)
  group.add(light)

  group.position.set(x, 0, z)
  group.rotation.y = Math.PI / 2
  scene.add(group)
}

createExit(-14, -5)
createExit( 14, -5)

// ─── スクリーン ────────────────────────────────────────────────────
const screenMat = new THREE.MeshStandardMaterial({ color: 0x2255cc, emissive: 0x1133aa, emissiveIntensity: 0.8 })

const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), screenMat)
screenMesh.position.set(0, 9, -9)
scene.add(screenMesh)

const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1d2a })
const frame = new THREE.Mesh(new THREE.BoxGeometry(25.2, 11.2, 0.15), frameMat)
frame.position.set(0, 9, -9.1)
scene.add(frame)

const signGeom = new THREE.BoxGeometry(26, 0.4, 0.1)
const signMat  = new THREE.MeshStandardMaterial({ color: 0x252A3A })
const sign = new THREE.Mesh(signGeom, signMat)
sign.position.set(0, 14.5, -9)
scene.add(sign)

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
  seatObj.state                = newState
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
let lastSelected = null

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
  active:    false,
  targetPos: new THREE.Vector3(),
  targetAt:  new THREE.Vector3()
}

controls.addEventListener('start', () => { camAnim.active = false })

function moveCameraTo(pos, lookAt) {
  camAnim.targetPos.copy(pos)
  camAnim.targetAt.copy(lookAt)
  camAnim.active = true
}

viewBtn.addEventListener('click', () => {
  if (!lastSelected) return

  if (!is3D) {
    is3D = true
    twoDWrap.classList.remove('active')
    toggle3dBtn.classList.add('active')
    toggle2dBtn.classList.remove('active')
  }

  const p = lastSelected.group.position
  moveCameraTo(
    new THREE.Vector3(p.x, p.y + 2, p.z + 1),
    new THREE.Vector3(0, 9, -9)
  )
})

resetViewBtn.addEventListener('click', () => {
  moveCameraTo(DEFAULT_CAM_POS.clone(), DEFAULT_CAM_TARGET.clone())
})

// ─── UI更新 ────────────────────────────────────────────────────────
function updateUI() {
  const selected = seatObjects.filter(s => s.state === STATE_SELECTED)
  const count    = selected.length

<<<<<<< Updated upstream
  countEl.textContent      = count
  totalPriceEl.textContent = (count * PRICE_PER_SEAT).toLocaleString()
  confirmBtn.disabled      = count === 0
=======
  countEl.textContent = count
  // 料金は券種選択ページで決まるため、ここでは非表示
  confirmBtn.disabled = count === 0
>>>>>>> Stashed changes

  if (count === 0) {
    selectedList.innerHTML = '<p class="zaseki-empty-msg">座席をクリックして選択してください</p>'
  } else {
    selectedList.innerHTML = selected.map(s =>
      `<span class="zaseki-seat-tag" data-label="${s.label}">${s.label}</span>`
    ).join('')

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

  viewSection.style.display = count > 0 ? 'flex' : 'none'
  if (!lastSelected) {
    lastSelected = selected[selected.length - 1] ?? null
  }
}

// 次へボタン
confirmBtn.addEventListener('click', () => {
  // 選択座席をsessionStorageに保存して次ページへ（2次開発で活用）
  const selected = seatObjects.filter(s => s.state === STATE_SELECTED)
<<<<<<< Updated upstream
  const reservationData = {
    reservationId : 'HAL-' + Date.now() + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
    movieTitle    : document.querySelector('.zaseki-movie-name').textContent,
    screenInfo    : document.querySelector('.zaseki-movie-title').textContent,
    screeningInfo : document.querySelector('.zaseki-movie-sub').textContent,
    seats         : selected.map(s => s.label),
    ticketCount   : selected.length,
    totalAmount   : selected.length * PRICE_PER_SEAT,
    issuedAt      : new Date().toISOString()
  }
  sessionStorage.setItem('reservationData', JSON.stringify(reservationData))
  location.href = 'goods.html'
=======
  const labels   = selected.map(s => s.label)
  sessionStorage.setItem('selectedSeats', JSON.stringify(labels))
  sessionStorage.setItem('seatCount', labels.length)

  // 券種選択ページへ遷移
  window.location.href = 'ticket-select.html'
})

// ─── 2D座席マップ ──────────────────────────────────────────────────
let is3D = true

function updateSeat2dEl(el, state) {
  el.classList.remove('zaseki-2d-seat--selected', 'zaseki-2d-seat--taken')
  if (state === STATE_SELECTED) el.classList.add('zaseki-2d-seat--selected')
  else if (state === STATE_TAKEN) el.classList.add('zaseki-2d-seat--taken')
}

function updateTwoD() {
  seatObjects.forEach(s => {
    const el = twoDGrid.querySelector(`[data-row="${s.row}"][data-col="${s.col}"]`)
    if (el) updateSeat2dEl(el, s.state)
  })
}

function buildTwoDMap() {
  twoDGrid.innerHTML = ''

  // 列番号ヘッダー（通常列 1〜14）
  const headerEl = document.createElement('div')
  headerEl.className = 'zaseki-2d-row'

  const headerLabelSpacer = document.createElement('span')
  headerLabelSpacer.className = 'zaseki-2d-row-label'
  headerEl.appendChild(headerLabelSpacer)

  for (let col = 0; col < COLS; col++) {
    if (col === 4 || col === 10) {
      const aisleEl = document.createElement('span')
      aisleEl.className = 'zaseki-2d-aisle'
      headerEl.appendChild(aisleEl)
    }
    const numEl = document.createElement('span')
    numEl.className = 'zaseki-2d-col-num'
    numEl.textContent = col + 1
    headerEl.appendChild(numEl)
  }

  twoDGrid.appendChild(headerEl)

  for (let row = 0; row < ROWS; row++) {
    const isBack  = row >= ROWS - ROWS_BACK
    const rowCols = isBack ? COLS_BACK : COLS

    const rowEl = document.createElement('div')
    rowEl.className = 'zaseki-2d-row'

    const labelEl = document.createElement('span')
    labelEl.className = 'zaseki-2d-row-label'
    labelEl.textContent = ROW_LABELS[row]
    rowEl.appendChild(labelEl)

    for (let col = 0; col < rowCols; col++) {
      if (!isBack && (col === 4 || col === 10)) {
        const aisleEl = document.createElement('span')
        aisleEl.className = 'zaseki-2d-aisle'
        rowEl.appendChild(aisleEl)
      }

      const seatObj = seatObjects.find(s => s.row === row && s.col === col)
      const btn = document.createElement('button')
      btn.className = 'zaseki-2d-seat'
      btn.dataset.row = row
      btn.dataset.col = col
      btn.title = seatObj.label
      updateSeat2dEl(btn, seatObj.state)

      if (seatObj.state !== STATE_TAKEN) {
        btn.addEventListener('click', () => {
          if (seatObj.state === STATE_AVAILABLE) {
            setSeatState(seatObj, STATE_SELECTED)
            lastSelected = seatObj
          } else {
            setSeatState(seatObj, STATE_AVAILABLE)
            lastSelected = seatObjects.find(s => s.state === STATE_SELECTED) ?? null
          }
          updateTwoD()
          updateUI()
        })
      }
      rowEl.appendChild(btn)
    }

    twoDGrid.appendChild(rowEl)
  }
}

toggle3dBtn.addEventListener('click', () => {
  if (is3D) return
  is3D = true
  twoDWrap.classList.remove('active')
  toggle3dBtn.classList.add('active')
  toggle2dBtn.classList.remove('active')
})

toggle2dBtn.addEventListener('click', () => {
  if (!is3D) return
  is3D = false
  twoDWrap.classList.add('active')
  toggle2dBtn.classList.add('active')
  toggle3dBtn.classList.remove('active')
  updateTwoD()
})

buildTwoDMap()

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
