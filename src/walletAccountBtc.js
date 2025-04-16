const bitcoin = require('bitcoinjs-lib')
const BigNumber = require('bignumber.js')

const DUST_LIMIT = 546

class WalletAccountBtc {
  constructor (config = {}) {
    this.electrumClient = config.electrumClient
    this.network = config.network
    this._max_fee_limit = 100000 || config.max_fee_limit
    this._getInternalAddress = config.getInternalAddress
    this._bip32 = config.bip32
    this._txData = []
    this.path = config.path || ''
    this.index = config.index || 0
    this.address = config.address || ''
    this.keyPair = config.keyPair || {}
  }

  async sign (message) {
    throw new Error('not implemented')
  }

  async verify (message, signature) {
    throw new Error('not implemented')
  }

  getLastAttempt () {
    return this._txData.at(-1)
  }

  async _createTransaction ({ address, amount }) {
    const sendAmount = amount
    const recipient = address
    const changeAddress = await this._getInternalAddress()

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
    const utxoSet = await this._collectUtxos(sendAmount, changeAddress.address)
    return await this._generateRawTx(utxoSet, sendAmount, recipient, changeAddress, feeRate)
  }

  async _collectUtxos (amount, address) {
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
        const tx = await this.electrumClient.getTransaction(utxo.tx_hash)
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

  async _generateRawTx (utxoSet, sendAmount, recipient, changeAddress, feeRate) {
    if (+sendAmount <= DUST_LIMIT) {
      throw new Error('send amount must be bigger than dust limit ' + DUST_LIMIT + ' got: ' + sendAmount)
    }

    let totalInput = new BigNumber(0)
    for (const utxo of utxoSet) {
      totalInput = totalInput.plus(utxo.value)
    }

    // Function to create a PSBT
    const createPsbt = (fee) => {
      const psbt = new bitcoin.Psbt({ network: this.network })

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
              masterFingerprint: this._bip32.fingerprint,
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
        psbt.signInputHD(index, this._bip32)
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

  async _broadcastTransaction (txHex) {
    try {
      return await this.electrumClient.broadcastTransaction(txHex)
    } catch (err) {
      console.error('Electrum broadcast error:', err)
      throw new Error('Failed to broadcast transaction: ' + err.message)
    }
  }

  async sendTransaction ({ sender, recipient, amount }) {
    const tx = await this._createTransaction({ sender, recipient, amount })
    try {
      await this._broadcastTransaction(tx.hex)
    } catch (err) {
      console.log(err)
      throw new Error('failed to broadcast tx')
    }
    return tx
  }
}

module.exports = WalletAccountBtc
