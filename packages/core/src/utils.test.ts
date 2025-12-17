import { describe, expect, it } from 'vitest'
import { toError } from './internal/utils'

describe('toError', () => {
  it('returns Error instances unchanged', () => {
    const error = new Error('test error')
    const result = toError(error)

    expect(result).toBe(error)
    expect(result.message).toBe('test error')
  })

  it('converts objects with message property to Error', () => {
    const obj = { message: 'error from object' }
    const result = toError(obj)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('error from object')
  })

  it('preserves name property from objects', () => {
    const obj = { message: 'custom error', name: 'CustomError' }
    const result = toError(obj)

    expect(result.name).toBe('CustomError')
    expect(result.message).toBe('custom error')
  })

  it('ignores non-string name property', () => {
    const obj = { message: 'error', name: 123 }
    const result = toError(obj)

    expect(result.name).toBe('Error')
    expect(result.message).toBe('error')
  })

  it('converts strings to Error', () => {
    const result = toError('string error')

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('string error')
  })

  it('converts numbers to Error', () => {
    const result = toError(42)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('42')
  })

  it('converts null to Error', () => {
    const result = toError(null)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('null')
  })

  it('converts undefined to Error', () => {
    const result = toError(undefined)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('undefined')
  })

  it('converts objects without message to Error', () => {
    const obj = { code: 'ERR_001' }
    const result = toError(obj)

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('[object Object]')
  })
})
