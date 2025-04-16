'use strict'

const ElectrumClient = require('../src/electrum-client')
const bitcoin = require('bitcoinjs-lib')

describe('ElectrumClient Integration Tests', () => {
  let client
  const testAddress = 'bcrt1q03lzm6tjtlng04lchtlpfk9hp93f5yrgklavtv'
  const testTxid = '4a5bb5118f60729348364b507e2ff5c1ec5b76dc973d57c93bbb527ceff468d0'

  beforeAll(async () => {
    client = new ElectrumClient({
      port: 8001,
      host: 'localhost',
      network: 'regtest'
    })
    await client.connect()
  })

  afterAll(async () => {
    await client.disconnect()
  })

  test('should connect to Electrum server', () => {
    expect(client.isConnected()).toBe(true)
  })

  test('should get balance for test address', async () => {
    const balance = await client.getBalance(testAddress)
    expect(balance).toHaveProperty('confirmed')
    expect(balance).toHaveProperty('unconfirmed')
    expect(typeof balance.confirmed).toBe('number')
    expect(typeof balance.unconfirmed).toBe('number')
  }, 10000)

  test('should get history for test address', async () => {
    const history = await client.getHistory(testAddress)
    expect(Array.isArray(history)).toBe(true)
    if (history.length > 0) {
      const tx = history[0]
      expect(tx).toHaveProperty('tx_hash')
      expect(tx).toHaveProperty('height')
    }
  })

  test('should get unspent outputs for test address', async () => {
    const unspent = await client.getUnspent(testAddress)
    expect(Array.isArray(unspent)).toBe(true)
    if (unspent.length > 0) {
      const utxo = unspent[0]
      expect(utxo).toHaveProperty('tx_hash')
      expect(utxo).toHaveProperty('tx_pos')
      expect(utxo).toHaveProperty('value')
      expect(utxo).toHaveProperty('height')
    }
  })

  test('should get transaction details', async () => {
    const tx = await client.getTransaction(testTxid)
    expect(typeof tx).toBe('object')
    expect(tx).toHaveProperty('hash')
    expect(tx).toHaveProperty('txid')
  })

  test('should get fee estimates', async () => {
    const fee = await client.getFeeEstimate(1)
    expect(typeof fee).toBe('number')
    expect(fee).toBeGreaterThan(0)
  })

  test('should handle script hash calculation', () => {
    const scriptHash = client.getScriptHash(testAddress)
    expect(typeof scriptHash).toBe('string')
    expect(scriptHash.length).toBe(64)
  })

  test('should handle disconnection', async () => {
    await client.disconnect()
    expect(client.isConnected()).toBe(false)

    await client.connect()
    expect(client.isConnected()).toBe(true)
  })

  test('should handle invalid address', async () => {
    const invalidAddress = 'invalid-address'
    await expect(client.getBalance(invalidAddress)).rejects.toThrow()
  })

  test('should handle invalid transaction ID', async () => {
    const invalidTxid = 'invalid-txid'
    await expect(client.getTransaction(invalidTxid)).rejects.toThrow()
  })

  test('should handle invalid broadcast', async () => {
    const invalidTx = 'invalid-transaction-hex'
    await expect(client.broadcastTransaction(invalidTx)).rejects.toThrow()
  })
})
