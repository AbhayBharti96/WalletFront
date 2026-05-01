import { describe, it, expect } from 'vitest'
import axios from 'axios'
import { getApiErrorMessage } from '@/shared/apiErrors'

describe('getApiErrorMessage', () => {
  it('reads message from axios error response body', () => {
    const err = new axios.AxiosError('fail')
    err.response = {
      status: 400,
      data: { message: 'Invalid input' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as import('axios').InternalAxiosRequestConfig,
    }
    expect(getApiErrorMessage(err)).toBe('Invalid input')
  })

  it('uses fallback for unknown errors', () => {
    expect(getApiErrorMessage(null, 'Nope')).toBe('Nope')
    expect(getApiErrorMessage(new Error('x'))).toBe('x')
  })

  it('maps network failure without response', () => {
    const err = new axios.AxiosError('Network Error')
    err.response = undefined
    expect(getApiErrorMessage(err)).toContain('Network')
  })

  it('maps blocked wallet errors to a clear user message', () => {
    const err = new axios.AxiosError('fail')
    err.response = {
      status: 403,
      data: { message: 'Wallet is blocked by admin' },
      statusText: 'Forbidden',
      headers: {},
      config: {} as import('axios').InternalAxiosRequestConfig,
    }
    expect(getApiErrorMessage(err)).toBe('Wallet is blocked. Transactions are disabled. Please contact support or the admin team.')
  })
})
