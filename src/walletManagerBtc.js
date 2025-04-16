/**
 * @fileoverview Wallet service for Bitcoin using HDNode
 */

'use strict'

const bip39 = require('bip39')
const BIP32 = require('bip32')
const bitcoin = require('bitcoinjs-lib')
const secp = require('@bitcoinerlab/secp256k1')
const BigNumber = require('bignumber.js')
const ElectrumClient = require('./electrum-client')
const WalletAccountBtc = require('./walletAccountBtc')

let bip32
async function loadWASM () {
  const ecc = await secp
  bip32 = BIP32.BIP32Factory(ecc)
}

/**
 * Service class for managing Bitcoin wallets
 */
class WalletManagerBtc {
  constructor (config = {}) {
    if (typeof config.network === 'string') {
      this.network =
        config.network === 'regtest'
          ? bitcoin.networks.regtest
          : bitcoin.networks.bitcoin
    } else {
      this.network = config.network || bitcoin.networks.bitcoin // Default to mainnet
    }
    config.network = this.network
    this.electrumClient = new ElectrumClient(config)
    this._baseDerivationPath = "m/84'/0'/0'/0" // Base BIP84 derivation path
    this._seedPhrase = config.seedPhrase
  }

  get seedPhrase () {
    return this._seedPhrase
  }

  set seedPhrase (phrase) {
    if (!this.isValidSeedPhrase(phrase)) {
      throw new Error('Invalid mnemonic phrase')
    }
    this._seedPhrase = phrase
  }

  getRandomSeedPhrase () {
    const mnemonic = bip39.generateMnemonic()
    return mnemonic
  }

  isValidSeedPhrase (seedPhrase) {
    return seedPhrase && bip39.validateMnemonic(seedPhrase)
  }

  /**
   * Creates a new wallet by index
   * @param {number} index - The index to derive the path from. Defaults to 0.
   * @returns {Promise<IWalletAccount>} The restored wallet details.
   */
  async getAccount (index = 0) {
    if (!this._seedPhrase) {
      return null
    }

    const derivationPath = this._getBIP84HDPathString(index)
    const child = this._deriveChild(this._seedPhrase, derivationPath)

    const address = bitcoin.payments.p2wpkh({
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
      electrumClient: this.electrumClient,
      network: this.network,
      bip32: this._seedToBip32(this._seedPhrase),
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
  _getBIP84HDPathString (index = 0) {
    if (typeof index === 'string') {
      const [account, change] = index.split('/').map(Number)
      return `m/84'/0'/${account || '0'}'/${change || '0'}`
    }
    return `${this._baseDerivationPath}/${index}`
  }

  btcToSats (btc) {
    const btcAmount = new BigNumber(btc)
    const satoshiAmount = btcAmount.multipliedBy(100000000)
    return satoshiAmount.integerValue().toNumber()
  }

  satsToBtc (satoshi) {
    const satoshiAmount = new BigNumber(satoshi)
    const btcAmount = satoshiAmount.dividedBy(100000000)
    return btcAmount.decimalPlaces(8).toNumber()
  }

  async init () {
    await loadWASM()
  }

  /**
   * Creates a new random HD wallet
   * @returns {Promise<Object>} A new HD wallet instance
   * @throws {Error} If wallet creation fails
   */
  async createWallet () {
    const mnemonic = bip39.generateMnemonic()
    return this.restoreWalletFromPhrase(mnemonic)
  }

  /**
   * Restores a wallet from a mnemonic phrase.
   * @param {string} mnemonic - The mnemonic phrase to restore from.
   * @returns {Promise<Object>} The restored wallet details.
   * @throws {Error} If the mnemonic phrase is invalid.
   */
  async restoreWalletFromPhrase (mnemonic) {
    if (!mnemonic) {
      throw new Error('Mnemonic phrase cannot be empty')
    }

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase')
    }

    const derivationPath = this._getBIP84HDPathString()
    const child = this._deriveChild(mnemonic, derivationPath)

    const address = bitcoin.payments.p2wpkh({
      pubkey: child.publicKey,
      network: this.network
    }).address

    return {
      mnemonic,
      address,
      publicKey: child.publicKey.toString('hex'),
      privateKey: child.toWIF(),
      derivationPath
    }
  }

  /**
   * Derives private keys from a mnemonic phrase using a specific derivation path
   */
  async derivePrivateKeysFromPhrase (mnemonic) {
    if (!mnemonic) {
      throw new Error('Mnemonic phrase cannot be empty')
    }

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase')
    }

    const derivationPath = this._getBIP84HDPathString()
    const child = this._deriveChild(mnemonic, derivationPath)

    return {
      privateKey: child.privateKey.toString('hex'),
      publicKey: child.publicKey.toString('hex')
    }
  }

  /**
   * @param {string} mnemonic - The mnemonic phrase to restore from.
   * @param {string} path - The BIP32 derivation path.
   * @returns {Object} - The derived node.
   * @private
   */
  _deriveChild (mnemonic, path) {
    const root = this._seedToBip32(mnemonic)
    const child = root.derivePath(path)
    return child
  }

  _seedToBip32 (mnemonic) {
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const root = bip32.fromSeed(seed)
    return root
  }
}

module.exports = WalletManagerBtc
