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

import { connect as _netConnect } from 'net'
import { connect as __tlsConnect } from 'tls'
import { networks, address as _address, crypto } from 'bitcoinjs-lib'

export default class ElectrumClient {
  #host
  #port
  #protocol
  #network
  #socket
  #connected
  #requestId
  #pendingRequests
  constructor (config = {}) {
    this.#host = config.host || 'electrum.blockstream.info'
    this.#port = config.port || 50001
    this.#protocol = config.protocol || 'tcp'
    if (typeof config.network === 'string') {
      this.#network = config.network === 'regtest' ? networks.regtest : networks.bitcoin
    } else {
      this.#network = config.network || networks.bitcoin // Default to mainnet
    }
    this.#socket = null
    this.#connected = false
    this.#requestId = 0
    this.#pendingRequests = new Map()
  }

  async connect () {
    return new Promise((resolve, reject) => {
      try {
        const socket = this.#protocol === 'tls'
          ? __tlsConnect(this.#port, this.#host)
          : _netConnect(this.#port, this.#host)

        socket.on('connect', () => {
          this.#socket = socket
          this.#connected = true
          this.setupSocket()
          resolve(true)
        })

        socket.on('error', (error) => {
          this.#connected = false
          reject(error)
        })

        socket.on('close', () => {
          this.#connected = false
        })
      } catch (error) {
        console.error('Failed to connect:', error)
        this.#connected = false
        reject(error)
      }
    })
  }

  setupSocket () {
    let buffer = ''

    this.#socket.on('data', (data) => {
      buffer += data.toString()

      while (true) {
        const newlineIndex = buffer.indexOf('\n')
        if (newlineIndex === -1) break

        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)

        try {
          const response = JSON.parse(line)
          this.handleResponse(response)
        } catch (error) {
          console.error('Failed to parse response:', error)
        }
      }
    })
  }

  handleResponse (response) {
    if (response.id && this.#pendingRequests.has(response.id)) {
      const { resolve, reject } = this.#pendingRequests.get(response.id)
      this.#pendingRequests.delete(response.id)

      if (response.error) {
        reject(new Error(response.error.message))
      } else {
        resolve(response.result)
      }
    }
  }

  async disconnect () {
    if (this.#socket && this.#connected) {
      this.#socket.end()
      this.#connected = false
    }
  }

  async request (method, params = []) {
    if (!this.isConnected()) {
      try {
        await this.connect()
      } catch (connectError) {
        throw new Error(`Failed to connect before request: ${connectError.message}`)
      }
    }

    return new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1000000)
      const request = {
        id,
        method,
        params
      }

      this.#pendingRequests.set(id, { resolve, reject })
      this.#socket.write(JSON.stringify(request) + '\n')
    })
  }

  async getBalance (address) {
    const scriptHash = this.getScriptHash(address)
    const result = await this.request('blockchain.scripthash.get_balance', [scriptHash])
    return {
      confirmed: result.confirmed,
      unconfirmed: result.unconfirmed
    }
  }

  async getHistory (address) {
    const scriptHash = this.getScriptHash(address)
    return await this.request('blockchain.scripthash.get_history', [scriptHash])
  }

  async getUnspent (address) {
    const scriptHash = this.getScriptHash(address)
    return await this.request('blockchain.scripthash.listunspent', [scriptHash])
  }

  async getTransaction (txid) {
    return await this.request('blockchain.transaction.get', [txid, true])
  }

  async broadcastTransaction (txHex) {
    return await this.request('blockchain.transaction.broadcast', [txHex])
  }

  async getFeeEstimate (blocks = 1) {
    return await this.request('blockchain.estimatefee', [blocks])
  }

  getScriptHash (address) {
    const script = _address.toOutputScript(address, this.#network)
    const hash = crypto.sha256(script)
    return Buffer.from(hash).reverse().toString('hex')
  }

  isConnected () {
    return this.#connected
  }
}
