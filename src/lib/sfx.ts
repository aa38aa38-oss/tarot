// 用 Web Audio 即時合成的簡單音效（不需要音檔）
let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('tarot-quest-muted') === '1'
} catch {
  /* ignore */
}

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem('tarot-quest-muted', m ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.08, slideTo?: number) {
  const a = ac()
  if (!a || muted) return
  const t = a.currentTime + start
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(start: number, dur: number, vol = 0.12, hp = 800) {
  const a = ac()
  if (!a || muted) return
  const t = a.currentTime + start
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  const g = a.createGain()
  g.gain.value = vol
  src.connect(f).connect(g).connect(a.destination)
  src.start(t)
}

export const sfx = {
  select: () => tone(880, 0, 0.06, 'square', 0.05),
  correct: () => { tone(660, 0, 0.08, 'square', 0.06); tone(990, 0.08, 0.12, 'square', 0.06) },
  wrong: () => { tone(220, 0, 0.18, 'sawtooth', 0.06, 140) },
  slash: () => { noise(0, 0.18, 0.18, 2000); tone(300, 0.05, 0.15, 'square', 0.07, 80) },
  miss: () => tone(500, 0, 0.2, 'triangle', 0.06, 900),
  magic: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.3, 'triangle', 0.07)),
  boom: () => { noise(0, 0.5, 0.25, 200); tone(120, 0, 0.5, 'sine', 0.2, 40) },
  heal: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.35, 'sine', 0.07)),
  hurt: () => { noise(0, 0.25, 0.2, 300); tone(160, 0, 0.25, 'square', 0.08, 60) },
  charge: () => tone(110, 0, 0.6, 'sawtooth', 0.05, 330),
  victory: () => [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, [0, 0.12, 0.24, 0.36, 0.6, 0.8, 0.92, 1.1][i], i === 7 ? 0.6 : 0.14, 'square', 0.06)),
  defeat: () => [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.25, 0.3, 'triangle', 0.07)),
}
