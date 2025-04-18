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
/**
 * @fileoverview Wallet service for Bitcoin using HDNode
 */

'use strict'

import { generateMnemonic, validateMnemonic, mnemonicToSeedSync } from 'bip39'
import { BIP32Factory } from 'bip32'
import { networks, payments } from 'bitcoinjs-lib'
import secp from '@bitcoinerlab/secp256k1'
import ElectrumClient from './electrum-client.js'
import WalletAccountBtc from './wallet-account-btc.js'

let bip32
async function loadWASM () {
  const ecc = await secp
  bip32 = BIP32Factory(ecc)
}

/**
 * Service class for managing Bitcoin wallets
 */
export default class WalletManagerBtc {
  #electrumClient
  #baseDerivationPath
  #seedPhrase

  constructor (config = {}) {
    if (typeof config.network === 'string') {
      this.network =
        config.network === 'regtest' ? networks.regtest : networks.bitcoin
    } else {
      this.network = config.network || networks.bitcoin // Default to mainnet
    }
    config.network = this.network
    this.#electrumClient = new ElectrumClient(config)
    this.#baseDerivationPath = "m/84'/0'/0'/0" // Base BIP84 derivation path
    this.#seedPhrase = config.seedPhrase
  }

  get seedPhrase () {
    return this.#seedPhrase
  }

  set seedPhrase (phrase) {
    if (!WalletManagerBtc.isValidSeedPhrase(phrase)) {
      throw new Error('Invalid mnemonic phrase')
    }
    this.#seedPhrase = phrase
  }

  /**
   * Returns a random BIP-39 seed phrase.
   *
   * @returns {string} The seed phrase.
   */
  static getRandomSeedPhrase () {
    const mnemonic = generateMnemonic()
    return mnemonic
  }

  /**
   * Checks if a seed phrase is valid.
   *
   * @param {string} seedPhrase - The seed phrase.
   * @returns {boolean} True if the seed phrase is valid.
   */
  static isValidSeedPhrase (seedPhrase) {
    return seedPhrase && validateMnemonic(seedPhrase)
  }

  /**
   * Returns the wallet account at a specific index (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
   *
   * @param {number} index - The index of the account to get.
   * @returns {Promise<IWalletAccount>} The account.
   */
  async getAccount (index = 0) {
    if (!this.#seedPhrase) {
      return null
    }

    const derivationPath = this.#getBIP84HDPathString(index)
    const child = this.#deriveChild(this.#seedPhrase, derivationPath)

    const address = payments.p2wpkh({
      pubkey: child.publicKey,
      network: this.network
    }).address

    return new WalletAccountBtc({
      path: derivationPath,
      index,
      address,
      keyPair: {
        publicKey: child.publicKey.toString('hex'),
        privateKey: child.toWIF()
      },
      electrumClient: this.#electrumClient,
      network: this.network,
      bip32: this.#seedToBip32(this.#seedPhrase),
      getInternalAddress: async () => {
        const wallet = await this.getAccount()
        return wallet
      }
    })
  }

  /**
   * Generates the BIP84 HD path string for a given index.
   * @param {number} index - The index to derive the path from. Defaults to 0.
   * @returns {string} The BIP84 HD path string.
   * @private
   */
  #getBIP84HDPathString (index = 0) {
    if (typeof index === 'string') {
      const [account, change] = index.split('/').map(Number)
      return `m/84'/0'/${account || '0'}'/${change || '0'}`
    }
    return `${this.#baseDerivationPath}/${index}`
  }

  async init () {
    await loadWASM()
  }

  /**
   * @param {string} mnemonic - The mnemonic phrase to restore from.
   * @param {string} path - The BIP32 derivation path.
   * @returns {Object} - The derived node.
   * @private
   */
  #deriveChild (mnemonic, path) {
    const root = this.#seedToBip32(mnemonic)
    const child = root.derivePath(path)
    return child
  }

  #seedToBip32 (mnemonic) {
    const seed = mnemonicToSeedSync(mnemonic)
    const root = bip32.fromSeed(seed)
    return root
  }
}
