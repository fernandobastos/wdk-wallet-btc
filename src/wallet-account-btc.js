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
import { crypto, Psbt } from 'bitcoinjs-lib'
import BigNumber from 'bignumber.js'

const DUST_LIMIT = 546

export default class WalletAccountBtc {
  #electrumClient
  #network
  #max_fee_limit
  #getInternalAddress
  #bip32
  #txData

  constructor (config = {}) {
    this.#electrumClient = config.electrumClient
    this.#network = config.network
    this.#max_fee_limit = 100000 || config.max_fee_limit
    this.#bip32 = config.bip32
    this.#txData = []
    /**
     * The derivation path of this account (see BIP-44).
     * @type {string}
     */
    this.path = config.path || ''
    /**
     * The derivation path's index of this account.
     * @type {number}
     */
    this.index = config.index || 0
    /**
     * The account's address.
     * @type {string}
     */
    this.address = config.address || ''
    /**
     * The account's key pair.
     * @type {Object} KeyPair
     * @property {string} publicKey - The public key in hex format
     * @property {string} privateKey - The private key in WIF format
     */
    this.keyPair = config.keyPair || {}
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    const messageHash = crypto.sha256(Buffer.from(message))
    return this.#bip32.sign(messageHash).toString('base64')
  }

  /**
   * Verifies a message signature.
   *
   * @param {string} message - The message to verify.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid, false otherwise.
   */
  async verify (message, signature) {
    try {
      const messageHash = crypto.sha256(Buffer.from(message))
      const signatureBuffer = Buffer.from(signature, 'base64')
      const result = this.#bip32.verify(messageHash, signatureBuffer)
      return result
    } catch (err) {
      return false
    }
  }

  async #createTransaction ({ recipient, amount }) {
    let feeRate
    try {
      const feeEstimate = await this.#electrumClient.getFeeEstimate(1)
      feeRate = new BigNumber(feeEstimate).multipliedBy(100000)
    } catch (err) {
      console.error('Electrum client error:', err)
      throw new Error('Failed to estimate fee: ' + err.message)
    }

    if(feeRate > 

    const utxoSet = await this.#collectUtxos(amount, this.address)
    return await this.#generateRawTx(
      utxoSet,
      amount,
      recipient,
      feeRate
    )
  }

  async #collectUtxos (amount, address) {
    let unspent
    try {
      unspent = await this.#electrumClient.getUnspent(address)
    } catch (err) {
      console.error('Electrum client error:', err)
      throw new Error('Failed to fetch UTXOs: ' + err.message)
    }

    if (!unspent || unspent.length === 0) {
      throw new Error('No unspent outputs available')
    }

    const collected = []
    let totalCollected = new BigNumber(0)

    for (const utxo of unspent) {
      try {
        const tx = await this.#electrumClient.getTransaction(utxo.tx_hash)
        const vout = tx.vout[utxo.tx_pos]
        collected.push({
          ...utxo,
          vout
        })
        totalCollected = totalCollected.plus(utxo.value)

        if (totalCollected.isGreaterThanOrEqualTo(amount)) {
          break
        }
      } catch (err) {
        console.error('Electrum client error:', err)
        throw new Error('Failed to fetch transaction: ' + err.message)
      }
    }

    return collected
  }

  async #generateRawTx (utxoSet, sendAmount, recipient, feeRate) {
    if (+sendAmount <= DUST_LIMIT) {
      throw new Error(
        'send amount must be bigger than dust limit ' +
          DUST_LIMIT +
          ' got: ' +
          sendAmount
      )
    }

    let totalInput = new BigNumber(0)
    for (const utxo of utxoSet) {
      totalInput = totalInput.plus(utxo.value)
    }

    // Function to create a PSBT
    const createPsbt = (fee) => {
      const psbt = new Psbt({ network: this.#network })

      utxoSet.forEach((utxo, index) => {
        psbt.addInput({
          hash: utxo.tx_hash,
          index: utxo.tx_pos,
          witnessUtxo: {
            script: Buffer.from(utxo.vout.scriptPubKey.hex, 'hex'),
            value: utxo.value
          },
          bip32Derivation: [
            {
              masterFingerprint: this.#bip32.fingerprint,
              path: this.path,
              pubkey: Buffer.from(this.keyPair.publicKey, 'hex')
            }
          ]
        })
      })

      psbt.addOutput({
        address: recipient,
        value: sendAmount
      })

      const change = totalInput.minus(sendAmount).minus(fee)
      if (change.isGreaterThan(DUST_LIMIT)) {
        psbt.addOutput({
          address: this.address,
          value: change.toNumber()
        })
      } else if (change.isLessThan(0)) {
        throw new Error('Insufficient balance.')
      }

      utxoSet.forEach((utxo, index) => {
        psbt.signInputHD(index, this.#bip32)
      })

      psbt.finalizeAllInputs()
      return psbt
    }

    let psbt = createPsbt(0)
    const dummyTx = psbt.extractTransaction()
    let estimatedFee = new BigNumber(feeRate)
      .multipliedBy(dummyTx.virtualSize())
      .integerValue(BigNumber.ROUND_CEIL)

    const minRelayFee = new BigNumber(141) // Minimum relay fee in satoshis
    estimatedFee = BigNumber.max(estimatedFee, minRelayFee)

    // Create the final PSBT with the correct fee
    psbt = createPsbt(estimatedFee)
    const tx = psbt.extractTransaction()
    const txHex = tx.toHex()
    const txId = tx.getId()
    return {
      txid: txId,
      hex: txHex
    }
  }

  async #broadcastTransaction (txHex) {
    try {
      return await this.#electrumClient.broadcastTransaction(txHex)
    } catch (err) {
      console.error('Electrum broadcast error:', err)
      throw new Error('Failed to broadcast transaction: ' + err.message)
    }
  }

  /**
   * Sends a transaction.
   *
   * @param {Object} options - The transaction options.
   * @param {string} options.to - The recipient address.
   * @param {number} options.amount - The amount to send in bitcoin.
   * @returns {Promise<Object>} The transaction details.
   */
  async sendTransaction ({ to, amount }) {
    const satoshi = new BigNumber(amount).multipliedBy(100000000).integerValue(BigNumber.ROUND_DOWN).toNumber()
    const tx = await this.#createTransaction({ recipient: to, amount: satoshi })
    try {
      await this.#broadcastTransaction(tx.hex)
    } catch (err) {
      console.log(err)
      throw new Error('failed to broadcast tx')
    }
    return tx.txid
  }
}
