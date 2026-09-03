declare module 'canvas-confetti' {
  type ConfettiOptions = {
    particleCount?: number
    spread?: number
    startVelocity?: number
    scalar?: number
    ticks?: number
    origin?: { x: number; y: number }
    colors?: string[]
    disableForReducedMotion?: boolean
  }

  function confetti(options?: ConfettiOptions): Promise<null> | null

  export default confetti
}
