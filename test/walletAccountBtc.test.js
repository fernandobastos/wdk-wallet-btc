const assert = require('assert')
const WalletManagerBtc = require('../src/walletManagerBtc')

describe('BTCAccount Send', () => {
  let walletManager

  beforeEach(async () => {
    walletManager = new WalletManagerBtc({
      port: 8001,
      host: 'localhost',
      network: 'regtest'
    })
    await walletManager.init()
  })

  it('should send a transaction successfully', async () => {
    const sender = {
      mnemonic: 'together wire turn hat cube card bargain utility state awesome party story'
    }
    const recipient = 'bcrt1q03lzm6tjtlng04lchtlpfk9hp93f5yrgklavtv'
    walletManager.seedPhrase = sender.mnemonic
    const account = await walletManager.getAccount()
    console.log(`Account: ${JSON.stringify(account)}`)
    const amount = 0.001

    const result = await account.sendTransaction({ sender, recipient, amount })

    assert.ok(result.txid, 'Transaction ID should be present')

    // Fetch transaction details from Electrum
    const electrumClient = walletManager.electrumClient
    const tx = await electrumClient.getTransaction(result.txid)
    assert.ok(tx, 'Transaction details should be fetched from Electrum')

    // Verify transaction outputs
    let totalOutput = 0
    let recipientOutputFound = false
    for (const vout of tx.vout) {
      totalOutput += vout.value
      if (vout.scriptPubKey.address === recipient && vout.value === amount) {
        recipientOutputFound = true
      }
    }
    assert.ok(recipientOutputFound, 'Recipient output should be present with the correct amount')

    // Calculate and verify fee
    const unspent = await electrumClient.getUnspent(addr.address)
    let totalInput = 0
    for (const utxo of unspent) {
      const tx = await electrumClient.getTransaction(utxo.tx_hash)
      totalInput += tx.vout[utxo.tx_pos].value
    }

    const fee = totalInput - totalOutput
    assert.ok(fee >= 0, 'Fee should be non-negative')
    assert.ok(fee <= 5000, 'Fee should not be too high') // Adjust the maximum fee as needed
  }, 30000)

  // it('fuzz', async () => {
  //   const sender = {
  //     mnemonic: 'together wire turn hat cube card bargain utility state awesome party story'
  //   }
  //   const recipient = 'bcrt1q03lzm6tjtlng04lchtlpfk9hp93f5yrgklavtv'
  //   const addr = await walletManager.restoreWalletFromPhrase(sender.mnemonic)

  //   await new Promise(resolve => setTimeout(resolve, 2000)) // cant do too many tx at once

  //   const numIterations = 10

  //   for (let i = 0; i < numIterations; i++) {
  //     // Generate a random amount between 0.00001 and 0.001 BTC
  //     const amount = Math.random() * 0.00099 + 0.00001

  //     const result = await walletManager.send({ sender, recipient, amount })
  //     assert.ok(result.txid, `Transaction ID should be present for iteration ${i + 1}`)
  //     // console.log(`Transaction ${i + 1} successful with amount: ${amount}`);
  //     await new Promise(resolve => setTimeout(resolve, 2000))
  //   }
  // }, 60000)
})
