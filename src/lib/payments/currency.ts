export interface ExchangeRateResponse {
  USDBRL: {
    bid: string
    ask: string
    timestamp: string
  }
}

export async function convertBrlToUsd(brlCents: number): Promise<number> {
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    const data: ExchangeRateResponse = await response.json()
    const rate = parseFloat(data.USDBRL.bid)
    // Convert BRL cents to USD cents
    return Math.round((brlCents / 100) / rate * 100)
  } catch (error) {
    console.error('Currency conversion error:', error)
    // Fallback rate (approximately 5 BRL = 1 USD)
    return Math.round((brlCents / 100) / 5.0 * 100)
  }
}

export async function convertUsdToBrl(usdCents: number): Promise<number> {
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    const data: ExchangeRateResponse = await response.json()
    const rate = parseFloat(data.USDBRL.ask)
    // Convert USD cents to BRL cents
    return Math.round((usdCents / 100) * rate * 100)
  } catch (error) {
    console.error('Currency conversion error:', error)
    // Fallback rate (approximately 5 BRL = 1 USD)
    return Math.round((usdCents / 100) * 5.0 * 100)
  }
}

export async function getCurrentUsdBrlRate(): Promise<number> {
  try {
    const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    const data: ExchangeRateResponse = await response.json()
    return parseFloat(data.USDBRL.bid)
  } catch (error) {
    console.error('Failed to get exchange rate:', error)
    return 5.0 // Fallback rate
  }
}
