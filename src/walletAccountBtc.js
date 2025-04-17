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
import { Psbt } from 'bitcoinjs-lib'
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
    this.#getInternalAddress = config.getInternalAddress
    this.#bip32 = config.bip32
    this.#txData = []
    this.path = config.path || ''
    this.index = config.index || 0
    this.address = config.address || ''
    this.keyPair = config.keyPair || {}
  }

  /**
   * Signs a message.
   *
   * @param {string} message - The message to sign.
   * @returns {Promise<string>} The message's signature.
   */
  async sign (message) {
    throw new Error('not implemented')
  }

  /**
   * Verifies a message signature.
   *
   * @param {string} message - The message to verify.
   * @param {string} signature - The signature to verify.
   * @returns {Promise<boolean>} True if the signature is valid, false otherwise.
   */
  async verify (message, signature) {
    throw new Error('not implemented')
  }

  getLastAttempt () {
    return this.#txData.at(-1)
  }

  async #createTransaction ({ address, amount }) {
    const sendAmount = amount
    const recipient = address
    const changeAddress = await this.#getInternalAddress()

    // Estimate fee rate
    let feeRate
    try {
      const feeEstimate = await this.electrumClient.getFeeEstimate(1)
      feeRate = new BigNumber(feeEstimate).multipliedBy(100000)
    } catch (err) {
      console.error('Electrum client error:', err)
      throw new Error('Failed to estimate fee: ' + err.message)
    }
    // Generate raw transaction
    const utxoSet = await this.#collectUtxos(sendAmount, changeAddress.address)
    return await this.#generateRawTx(utxoSet, sendAmount, recipient, changeAddress, feeRate)
  }

  async #collectUtxos (amount, address) {
    let unspent
    try {
      unspent = await this.electrumClient.getUnspent(address)
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

  async #generateRawTx (utxoSet, sendAmount, recipient, changeAddress, feeRate) {
    if (+sendAmount <= DUST_LIMIT) {
      throw new Error('send amount must be bigger than dust limit ' + DUST_LIMIT + ' got: ' + sendAmount)
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
              path: changeAddress.derivationPath,
              pubkey: Buffer.from(changeAddress.publicKey, 'hex')
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
          address: changeAddress.address,
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
    let estimatedFee = new BigNumber(feeRate).multipliedBy(dummyTx.virtualSize()).integerValue(BigNumber.ROUND_CEIL)

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

  async sendTransaction ({ sender, recipient, amount }) {
    const tx = await this.#createTransaction({ sender, recipient, amount })
    try {
      await this.#broadcastTransaction(tx.hex)
    } catch (err) {
      console.log(err)
      throw new Error('failed to broadcast tx')
    }
    return tx
  }
}
