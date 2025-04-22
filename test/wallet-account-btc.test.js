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
import { ok } from "assert";
import WalletManagerBtc from "../src/wallet-manager-btc.js";
import { test, hook } from 'brittle'

let walletManager;
hook('before',async () => {
  walletManager = new WalletManagerBtc({
    port: 8001,
    host: "localhost",
    network: "regtest",
  });
  walletManager.seedPhrase =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

});


test("should sign a message", async (t) => {
  const account = await walletManager.getAccount();
  const signature = await account.sign("Hello, world!");
  t.ok(signature);
});

test("should verify a message signature", async (t) => {
  const account = await walletManager.getAccount();
  const signature = await account.sign("Hello, world!");
  const isValid = await account.verify("Hello, world!", signature);
  t.ok(isValid);
});

test("should verify a message signature against an invalid signature", async (t) => {
  const account = await walletManager.getAccount();
  const isValid = await account.verify("Hello, world!", "invalid");
  t.is(isValid, false);
});

test("should send a transaction successfully", async (t) => {
  const sender = {
    mnemonic:
      "together wire turn hat cube card bargain utility state awesome party story",
  };
  const recipient = "bcrt1q03lzm6tjtlng04lchtlpfk9hp93f5yrgklavtv";
  walletManager.seedPhrase = sender.mnemonic;
  const account = await walletManager.getAccount();
  console.log(`Account: ${JSON.stringify(account)}`);
  const amount = 0.001;

  const result = await account.sendTransaction({ sender, recipient, amount });

  t.ok(result);
}, 30000);

test('fuzz sending', async (t) => {
  const sender = {
  mnemonic: 'together wire turn hat cube card bargain utility state awesome party story'
  }
  const recipient = 'bcrt1q03lzm6tjtlng04lchtlpfk9hp93f5yrgklavtv'
  const account = await walletManager.getAccount()

  await new Promise(resolve => setTimeout(resolve, 2000)) // cant do too many tx at once

  const numIterations = 10

  for (let i = 0; i < numIterations; i++) {
  // Generate a random amount between 0.00001 and 0.001 BTC
  const amount = Math.random() * 0.00099 + 0.00001
    t.comment('sending   ', amount)

  const result = await account.sendTransaction({ sender, recipient, amount })
  t.ok(result, `Transaction ID should be present for iteration ${i + 1}`)
  // console.log(`Transaction ${i + 1} successful with amount: ${amount}`);
  await new Promise(resolve => setTimeout(resolve, 2000))
  }
}, 60000)
