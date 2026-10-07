import confetti from 'canvas-confetti'

/**
 * Triggers a brief, elegant side-burst confetti celebration upon successful sale completion.
 * Respects system prefers-reduced-motion settings.
 */
export function celebrateSale() {
  if (typeof window === 'undefined') return

  // Check for reduced motion preference
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  // Left burst
  confetti({
    particleCount: 35,
    spread: 55,
    startVelocity: 28,
    origin: { x: 0.25, y: 0.65 },
    disableForReducedMotion: false,
    scalar: 0.9,
  })

  // Right burst
  confetti({
    particleCount: 35,
    spread: 55,
    startVelocity: 28,
    origin: { x: 0.75, y: 0.65 },
    disableForReducedMotion: false,
    scalar: 0.9,
  })
}
