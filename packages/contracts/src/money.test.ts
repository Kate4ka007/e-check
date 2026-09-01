import { describe, expect, it } from 'vitest'
import {
  addMinor,
  assertIntegerMinor,
  currencyExponent,
  distributeSum,
  formatMoney,
  parseMoneyToMinor,
  subtractMinor,
} from './money.js'

describe('money', () => {
  it('adds and subtracts minor units', () => {
    expect(addMinor(100, 50)).toBe(150)
    expect(subtractMinor(100, 30)).toBe(70)
  })

  it('rejects fractional minor units', () => {
    expect(() => assertIntegerMinor(1.5)).toThrow(/integer minor units/)
  })

  it('splits sum exactly across items', () => {
    expect(distributeSum(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(distributeSum(100, [1, 1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('assigns remainder to largest fractional parts', () => {
    expect(distributeSum(10, [1, 2, 3])).toEqual([2, 3, 5])
  })

  it('formats EUR, JPY and BHD', () => {
    expect(formatMoney(278, 'EUR', 'de-DE')).toContain('2,78')
    expect(formatMoney(1500, 'JPY', 'ja-JP')).toMatch(/1[,.]?500/)
    expect(currencyExponent('BHD')).toBe(3)
    expect(formatMoney(1234, 'BHD', 'en-US')).toContain('1.234')
  })

  it('parses comma and dot decimals', () => {
    expect(parseMoneyToMinor('2,78', 'EUR')).toBe(278)
    expect(parseMoneyToMinor('2.78', 'EUR')).toBe(278)
  })
})
