import { describe, it, expect } from 'vitest'
import { searchInIndex, buildIndex, normalize } from './useProductSearchIndex'
import type { ProduitModel } from '../types'

function makeProduct(name: string, overrides: Partial<ProduitModel> = {}): ProduitModel {
  return {
    id: Math.floor(Math.random() * 100000),
    name,
    cip1: null,
    cip2: null,
    cip3: null,
    cip4: null,
    stock: 0,
    cost_price: '0',
    selling_price: '0',
    tva: '20',
    is_active: true,
    ...overrides,
  } as ProduitModel
}

describe('searchInIndex', () => {
  const products = [
    makeProduct('DOLIPRANE FRA1'),
    makeProduct('FRAXIPARINE 10MG'),
    makeProduct('AFRIN SPRAY'),
    makeProduct('RFACT'),
    makeProduct('FARGAN'),
    makeProduct('DOLIPRANE 500MG'),
    makeProduct('SPASFRAN'),
    makeProduct('FRAXIPARINE FRA2'),
  ]

  const index = buildIndex(products)

  it('recherche stricte sur sous-chaîne contiguë : FRA1', () => {
    const results = searchInIndex(index, 'FRA1', 50).map(p => p.name)
    console.log('FRA1 results:', results)
    expect(results).toContain('DOLIPRANE FRA1')
    expect(results).not.toContain('FRAXIPARINE FRA2') // FRA2 ≠ FRA1
    expect(results).not.toContain('FRAXIPARINE 10MG')
    expect(results).not.toContain('AFRIN SPRAY')
    expect(results).not.toContain('RFACT')
    expect(results).not.toContain('FARGAN')
    expect(results).not.toContain('DOLIPRANE 500MG')
    expect(results).not.toContain('SPASFRAN')
  })

  it('match nom compact sans espaces au début : FRA1 doit matcher "FRA 1 DOLIPRANE"', () => {
    const productsWithSpace = [
      makeProduct('FRA 1 DOLIPRANE'),
      makeProduct('FAR 1 DOLIPRANE'),
    ]
    const idx = buildIndex(productsWithSpace)
    const results = searchInIndex(idx, 'FRA1', 50).map(p => p.name)
    console.log('FRA1 compact results:', results)
    expect(results).toContain('FRA 1 DOLIPRANE')
    expect(results).not.toContain('FAR 1 DOLIPRANE')
  })

  it('FRA seul match uniquement les mots commençant par FRA', () => {
    const results = searchInIndex(index, 'FRA', 50).map(p => p.name)
    console.log('FRA results:', results)
    expect(results).toContain('FRAXIPARINE 10MG')
    expect(results).toContain('FRAXIPARINE FRA2')
    expect(results).toContain('DOLIPRANE FRA1')
    // Les mots qui ne commencent pas par "fra" ne doivent pas matcher
    expect(results).not.toContain('SPASFRAN')
    expect(results).not.toContain('AFRIN SPRAY')
    expect(results).not.toContain('RFACT')
    expect(results).not.toContain('FARGAN')
    expect(results).not.toContain('DOLIPRANE 500MG')
  })

  it('multi-termes : DOLI 500', () => {
    const results = searchInIndex(index, 'DOLI 500', 50).map(p => p.name)
    console.log('DOLI 500 results:', results)
    expect(results).toContain('DOLIPRANE 500MG')
  })

  it('CIP exact prioritaire', () => {
    const productsWithCip = [
      makeProduct('PRODUIT A', { cip1: '123456' }),
      makeProduct('123456 COMPRIME'),
      makeProduct('AUTRE'),
    ]
    const idx = buildIndex(productsWithCip)
    const results = searchInIndex(idx, '123456', 50).map(p => p.name)
    console.log('CIP 123456 results:', results)
    expect(results[0]).toBe('PRODUIT A')
  })
})

describe('normalize', () => {
  it('met en minuscule et retire les accents', () => {
    expect(normalize('DoliprânÉ')).toBe('doliprane')
  })
})

describe('produits réels de la base', () => {
  it('FRANCE LAIT 2 B/900G match france', () => {
    const idx = buildIndex([makeProduct('FRANCE LAIT 2 B/900G')])
    const results = searchInIndex(idx, 'france', 50).map(p => p.name)
    console.log('france results:', results)
    expect(results).toContain('FRANCE LAIT 2 B/900G')
  })
})
