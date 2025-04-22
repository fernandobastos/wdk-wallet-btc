// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict'

import ElectrumClient from '../src/electrum-client.js'
import { test, hook } from 'brittle'

let client
const testAddress = 'bcrt1q03lzm6tjtlng04lchtlpfk9hp93f5yrgklavtv'
const testTxid = '4a5bb5118f60729348364b507e2ff5c1ec5b76dc973d57c93bbb527ceff468d0'

hook(async () => {
  client = new ElectrumClient({
    port: 8001,
    host: 'localhost',
    network: 'regtest'
  })
  await client.connect()
})



test('should connect to Electrum server', (t) => {
  t.ok(client.isConnected(), 'Client should be connected')
})

test('should get balance for test address', async (t) => {
  const balance = await client.getBalance(testAddress)
  t.ok(balance.hasOwnProperty('confirmed'), 'Balance should have confirmed property')
  t.ok(balance.hasOwnProperty('unconfirmed'), 'Balance should have unconfirmed property')
  t.is(typeof balance.confirmed, 'number', 'Confirmed balance should be a number')
  t.is(typeof balance.unconfirmed, 'number', 'Unconfirmed balance should be a number')
})

test('should get history for test address', async (t) => {
  const history = await client.getHistory(testAddress)
  t.ok(Array.isArray(history), 'History should be an array')
  if (history.length > 0) {
    const tx = history[0]
    t.ok(tx.hasOwnProperty('tx_hash'), 'Transaction should have tx_hash property')
    t.ok(tx.hasOwnProperty('height'), 'Transaction should have height property')
  }
})

test('should get unspent outputs for test address', async (t) => {
  const unspent = await client.getUnspent(testAddress)
  t.ok(Array.isArray(unspent), 'Unspent outputs should be an array')
  if (unspent.length > 0) {
    const utxo = unspent[0]
    t.ok(utxo.hasOwnProperty('tx_hash'), 'UTXO should have tx_hash property')
    t.ok(utxo.hasOwnProperty('tx_pos'), 'UTXO should have tx_pos property')
    t.ok(utxo.hasOwnProperty('value'), 'UTXO should have value property')
    t.ok(utxo.hasOwnProperty('height'), 'UTXO should have height property')
  }
})

test('should get transaction details', async (t) => {
  const tx = await client.getTransaction(testTxid)
  t.is(typeof tx, 'object', 'Transaction should be an object')
  t.ok(tx.hasOwnProperty('hash'), 'Transaction should have hash property')
  t.ok(tx.hasOwnProperty('txid'), 'Transaction should have txid property')
})

test('should get fee estimates', async (t) => {
  const fee = await client.getFeeEstimate(1)
  t.is(typeof fee, 'number', 'Fee should be a number')
  t.ok(fee > 0, 'Fee should be greater than 0')
})

test('should handle script hash calculation', (t) => {
  const scriptHash = client.getScriptHash(testAddress)
  t.is(typeof scriptHash, 'string', 'Script hash should be a string')
  t.is(scriptHash.length, 64, 'Script hash should be 64 characters long')
})

test('should handle disconnection', async (t) => {
  await client.disconnect()
  t.is(client.isConnected(), false, 'Client should be disconnected')

  await client.connect()
  t.ok(client.isConnected(), 'Client should be connected')
})

test('should handle invalid address', async (t) => {
  const invalidAddress = 'invalid-address'
  await t.exception(() => client.getBalance(invalidAddress), 'Should throw an error')
})

test('should handle invalid transaction ID', async (t) => {
  const invalidTxid = 'invalid-txid'
  await t.exception(() => client.getTransaction(invalidTxid), 'Should throw an error')
})

test('should handle invalid broadcast', async (t) => {
  const invalidTx = 'invalid-transaction-hex'
  await t.exception(() => client.broadcastTransaction(invalidTx), 'Should throw an error')
})
hook(async () => {
  await client.disconnect()
})
