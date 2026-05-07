'use strict'

const fs   = require('fs')
const path = require('path')
const { deflateSync } = require('zlib')

// ── PNG builder ───────────────────────────────────────────────────────────

function buildPng(width, height, pixels) {
  const tbl = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    tbl[n] = c
  }
  const crc = buf => {
    let c = 0xFFFFFFFF
    for (const b of buf) c = tbl[(c ^ b) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }
  const chunk = (type, data) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length)
    const t = Buffer.from(type, 'ascii')
    const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([t, data])))
    return Buffer.concat([l, t, data, cr])
  }
  const rows = []
  for (let y = 0; y < height; y++) {
    rows.push(0)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      rows.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
    }
  }
  const hdr = Buffer.alloc(13)
  hdr.writeUInt32BE(width, 0); hdr.writeUInt32BE(height, 4)
  hdr[8] = 8; hdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', hdr),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ── ICO builder (embeds PNGs directly — Vista+ format) ────────────────────

function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length
  let dataOffset = 6 + count * 16

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(count, 4)

  const entries = []
  for (let i = 0; i < count; i++) {
    const entry = Buffer.alloc(16)
    const s = sizes[i]
    entry[0] = s >= 256 ? 0 : s
    entry[1] = s >= 256 ? 0 : s
    entry[2] = 0; entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(pngBuffers[i].length, 8)
    entry.writeUInt32LE(dataOffset, 12)
    dataOffset += pngBuffers[i].length
    entries.push(entry)
  }

  return Buffer.concat([header, ...entries, ...pngBuffers])
}

// ── Draw the GitPulse icon at any size ────────────────────────────────────

function drawIcon(S) {
  const [sr, sg, sb] = [96, 165, 250]   // brand blue #60a5fa
  const rad  = Math.max(2, Math.round(S * 0.18))
  const px   = new Uint8Array(S * S * 4)

  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= S || y < 0 || y >= S) return
    const i = (y * S + x) * 4
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a
  }

  // Dark rounded-rect background
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let inside = true
      if      (x < rad    && y < rad)    inside = (x - rad) ** 2       + (y - rad) ** 2       < rad * rad
      else if (x >= S-rad && y < rad)    inside = (x - (S-rad-1)) ** 2 + (y - rad) ** 2       < rad * rad
      else if (x < rad    && y >= S-rad) inside = (x - rad) ** 2       + (y - (S-rad-1)) ** 2 < rad * rad
      else if (x >= S-rad && y >= S-rad) inside = (x - (S-rad-1)) ** 2 + (y - (S-rad-1)) ** 2 < rad * rad
      if (inside) set(x, y, 15, 23, 42)
      else        set(x, y, 0, 0, 0, 0)
    }
  }

  // Node positions (proportional)
  const nodeR = Math.max(1, Math.round(S * 0.094))
  const lw    = Math.max(1, Math.round(S * 0.055))
  const ax = Math.round(S * 0.31), ay = Math.round(S * 0.28)
  const bx = Math.round(S * 0.31), by = Math.round(S * 0.72)
  const cx = Math.round(S * 0.69), cy = Math.round(S * 0.28)

  const dot = (ox, oy, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r) set(ox + dx, oy + dy, sr, sg, sb)
  }

  const line = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2
    for (let i = 0; i <= steps; i++) {
      const lx = Math.round(x1 + dx * i / steps)
      const ly = Math.round(y1 + dy * i / steps)
      for (let wy = 0; wy < lw; wy++)
        for (let wx = 0; wx < lw; wx++)
          set(lx + wx, ly + wy, sr, sg, sb)
    }
  }

  line(ax, ay + nodeR + 1, bx, by - nodeR - 1)  // trunk
  line(ax, ay + nodeR + 1, cx, cy - nodeR - 1)  // branch
  dot(ax, ay, nodeR)
  dot(bx, by, nodeR)
  dot(cx, cy, nodeR)

  return buildPng(S, S, px)
}

// ── Write files ───────────────────────────────────────────────────────────

const assetsDir = path.join(__dirname, '..', 'assets')
fs.mkdirSync(assetsDir, { recursive: true })

const sizes      = [256, 48, 32, 16]
const pngBuffers = sizes.map(drawIcon)

fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuffers[0])
console.log('  icon.png  (256x256)')

const icoBuffer = buildIco(pngBuffers, sizes)
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer)
console.log('  icon.ico  (256 / 48 / 32 / 16 px)')
console.log('Done. Run  npm run build  to package.')
