import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnimatedNumber } from './AnimatedNumber'

describe('AnimatedNumber', () => {
  it('affiche la valeur formatee', () => {
    render(<AnimatedNumber value={1500} duration={0} />)
    expect(screen.getByText('1500')).toBeInTheDocument()
  })

  it('utilise le formatValue personnalise', () => {
    render(
      <AnimatedNumber
        value={99.5}
        duration={0}
        formatValue={(v) => `${v.toFixed(1)} %`}
      />
    )
    expect(screen.getByText('99.5 %')).toBeInTheDocument()
  })
})
