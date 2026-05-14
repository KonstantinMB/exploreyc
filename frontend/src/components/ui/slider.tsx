import * as React from "react"

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  max: number
  min?: number
  step?: number
  className?: string
}

export function Slider({
  value,
  onValueChange,
  max,
  min = 0,
  step = 1,
  className = "",
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange([Number(e.target.value)])
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0] || min}
      onChange={handleChange}
      className={`w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary ${className}`}
      style={{
        background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((value[0] - min) / (max - min)) * 100}%, hsl(var(--muted)) ${((value[0] - min) / (max - min)) * 100}%, hsl(var(--muted)) 100%)`
      }}
    />
  )
}
