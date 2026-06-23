import * as THREE from 'three'

// ─── Canvas & sizes ───────────────────────────────────────────
const canvas = document.getElementById('hero-cinema')
const hero   = document.querySelector('.hero')

const sizes = { width: 0, height: 0 }
const updateSizes = () => {
  sizes.width  = hero.clientWidth
  sizes.height = hero.clientHeight
}
updateSizes()

// ─── Renderer ─────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// ─── Scene ────────────────────────────────────────────────────
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x0a0c14, 0.03)

// ─── Lights ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.2))

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
dirLight.position.set(0, 10, 5)
scene.add(dirLight)

// スクリーンからの反射光
const screenLight = new THREE.PointLight(0x4488ff, 5.0, 30)
screenLight.position.set(0, 4, -6)
scene.add(screenLight)

// ─── 動画テクスチャ ────────────────────────────────────────────
const video = document.createElement('video')
video.src = '../video/prada.mp4'
video.muted = true
video.autoplay = true
video.loop = true
video.playsInline = true
video.play().catch(() => {})

const videoTexture = new THREE.VideoTexture(video)
videoTexture.colorSpace = THREE.SRGBColorSpace

// ─── スクリーン ────────────────────────────────────────────────
const SW = 12.0, SH = 6.75  // 16:9
const SCREEN_Z = -7
const SCREEN_Y = 4.0

const screenMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(SW, SH),
  new THREE.MeshBasicMaterial({ map: videoTexture })
)
screenMesh.position.set(0, SCREEN_Y, SCREEN_Z)
scene.add(screenMesh)

const frame = new THREE.Mesh(
  new THREE.BoxGeometry(SW + 1.0, SH + 1.0, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x05070a })
)
frame.position.set(0, SCREEN_Y, SCREEN_Z - 0.1)
scene.add(frame)

// ─── 座席（zaseki.js の createSeatGroup を装飾用に簡略化）────────
const matSeat = new THREE.MeshStandardMaterial({ color: 0x2e3248 })

function createSeat(x, y, z) {
  const group = new THREE.Group()

  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), matSeat)
  base.position.y = 0.5
  group.add(base)

  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), matSeat)
  back.position.set(0, 1.1, 0.4)
  group.add(back)

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 1), matSeat)
  leftArm.position.set(-0.55, 0.75, 0)
  group.add(leftArm)

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 1), matSeat)
  rightArm.position.set(0.55, 0.75, 0)
  group.add(rightArm)

  group.position.set(x, y, z)
  scene.add(group)
}

// 3行 × 10列（zaseki.js と同じ SPACING_Z / HEIGHT_STEP で段差を再現）
const SEAT_ROWS  = 3
const SEAT_COLS  = 10
const SPACING_X  = 1.5
const SPACING_Z  = 2.0
const HEIGHT_STEP = 0.5
const seatOffsetX = (SEAT_COLS - 1) * SPACING_X / 2

for (let row = 0; row < SEAT_ROWS; row++) {
  for (let col = 0; col < SEAT_COLS; col++) {
    const x = col * SPACING_X - seatOffsetX
    const z = 0 - row * SPACING_Z                      // row0: z=0, row1: z=-2
    const y = (SEAT_ROWS - 1 - row) * HEIGHT_STEP      // row0: y=1.0, row1: y=0.5, row2: y=0
    createSeat(x, y, z)
  }
}

// ─── カメラ ────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 80)
const CAM_BASE = new THREE.Vector3(1.2, 5, 4)
const CAM_LOOK = new THREE.Vector3(-2, 3.5, -5)
camera.position.copy(CAM_BASE)
camera.lookAt(CAM_LOOK)
scene.add(camera)

// ─── マウス追従 ────────────────────────────────────────────────
const mouse       = { x: 0, y: 0 }
const mouseTarget = { x: 0, y: 0 }

hero.addEventListener('mousemove', (e) => {
  const rect = hero.getBoundingClientRect()
  mouseTarget.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
  mouseTarget.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
})

hero.addEventListener('mouseleave', () => {
  mouseTarget.x = 0
  mouseTarget.y = 0
})

// ─── リサイズ ──────────────────────────────────────────────────
window.addEventListener('resize', () => {
  updateSizes()
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// ─── アニメーションループ ──────────────────────────────────────
const tick = () => {
  mouse.x += (mouseTarget.x - mouse.x) * 0.06
  mouse.y += (mouseTarget.y - mouse.y) * 0.06

  const dx = mouse.x * 0.5
  const dy = mouse.y * 0.25

  camera.position.x = CAM_BASE.x + dx
  camera.position.y = CAM_BASE.y + dy
  camera.lookAt(CAM_LOOK.x + dx * 0.3, CAM_LOOK.y + dy * 0.3, CAM_LOOK.z)

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()
