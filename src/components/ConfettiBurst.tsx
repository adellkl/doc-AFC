import type { CSSProperties } from 'react'

const colours = ['#245A43', '#3C56D7', '#FFCE9B', '#D8FF41', '#F2C2D4']

const particles = Array.from({ length: 42 }, (_, index) => {
  const size = 5 + (index % 4) * 2
  return {
    id: index,
    colour: colours[index % colours.length],
    left: `${(index * 17 + 5) % 100}%`,
    delay: `${-((index * 0.43) % 7)}s`,
    duration: `${5.8 + (index % 6) * 0.65}s`,
    drift: `${((index * 19) % 120) - 60}px`,
    size,
    radius: index % 3 === 0 ? '999px' : index % 3 === 1 ? '1px' : '0px',
  }
})

export function ConfettiBurst() {
  return (
    <div className="confetti-rain" aria-hidden="true">
      {particles.map((particle) => {
        const style = {
          '--confetti-delay': particle.delay,
          '--confetti-duration': particle.duration,
          '--confetti-drift': particle.drift,
          backgroundColor: particle.colour,
          borderRadius: particle.radius,
          height: `${particle.size}px`,
          left: particle.left,
          width: `${Math.max(4, particle.size * 0.62)}px`,
        } as CSSProperties & Record<'--confetti-delay' | '--confetti-duration' | '--confetti-drift', string>

        return <span key={particle.id} className="confetti-particle" style={style} />
      })}
    </div>
  )
}
