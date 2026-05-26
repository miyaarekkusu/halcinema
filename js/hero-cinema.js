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

// ─── Lights ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.5))

const glow = new THREE.PointLight(0x4466cc, 2.0, 20)
glow.position.set(0, 0, 3)
scene.add(glow)

// ─── 動画テクスチャ ────────────────────────────────────────────
const video = document.createElement('video')
video.src = '../video/prada.mp4'  // ← 動画ファイルのパスを変更
video.muted = true
video.autoplay = true
video.loop = true
video.playsInline = true
video.play().catch(() => {})

const videoTexture = new THREE.VideoTexture(video)
videoTexture.colorSpace = THREE.SRGBColorSpace

// ─── スクリーン (16:9) ─────────────────────────────────────────
const SW = 8.0, SH = 4.5
const screenMat = new THREE.MeshBasicMaterial({ map: videoTexture })
const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat)
screenMesh.position.set(0, 0, 0)
scene.add(screenMesh)

// フレーム
const frame = new THREE.Mesh(
  new THREE.BoxGeometry(SW + 0.8, SH + 0.8, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x05070a })
)
frame.position.set(0, 0, -0.12)
scene.add(frame)

// ─── カメラ (右斜め、スクリーン大きく、右寄り構図) ───────────────
const camera = new THREE.PerspectiveCamera(40, sizes.width / sizes.height, 0.1, 80)
const CAM_BASE = new THREE.Vector3(1.5, 1.2, 10.0)
const CAM_LOOK = new THREE.Vector3(-3.5, 0, 0)
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

  const dx = mouse.x * 0.3
  const dy = mouse.y * 0.2

  camera.position.x = CAM_BASE.x + dx
  camera.position.y = CAM_BASE.y + dy
  camera.lookAt(CAM_LOOK.x + dx, CAM_LOOK.y + dy, CAM_LOOK.z)

  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
tick()
