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
"use strict";

import WalletManagerBtc from "../src/wallet-manager-btc.js";
import { payments, networks } from "bitcoinjs-lib";
import { mnemonicToSeedSync, validateMnemonic } from "bip39";
import { BIP32Factory } from "bip32";
import ecc from "@bitcoinerlab/secp256k1";
import { test } from 'brittle'

test("WalletManagerBtc BIP84 Tests", async (t) => {
  let wallet;

  t.beforeEach(async () => {
    wallet = new WalletManagerBtc();
  });

  test("BIP84 Derivation Path Tests", async (t) => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    t.test("should generate correct BIP84 derivation path", async (t) => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      t.is(walletAccount.path, "m/84'/0'/0'/0/0");
    });

    t.test("should generate correct BIP84 addresses", async (t) => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      t.is(walletAccount.address, "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
    });

    t.test("should generate correct extended public key", async (t) => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      t.is(walletAccount.keyPair.publicKey,
        "0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c"
      );
    });

    t.test("should generate correct private key", async (t) => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      t.is(walletAccount.keyPair.privateKey,
        "KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d"
      );
    });
  });

  test("BIP84 Receiving and Change Address Tests", async (t) => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    t.test("should generate correct second receiving address (m/84'/0'/0'/0/1)", async (t) => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(1);
      t.is(walletAccount.path, "m/84'/0'/0'/0/1");
      t.is(walletAccount.address, "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g");
    });

    t.test("should generate correct first change address (m/84'/0'/0'/1/0)", async (t) => {
      const seed = mnemonicToSeedSync(testMnemonic);
      const root = BIP32Factory(ecc).fromSeed(seed);
      const child = root.derivePath("m/84'/0'/0'/1/0");

      const address = payments.p2wpkh({
        pubkey: child.publicKey,
        network: networks.bitcoin,
      }).address;

      t.is(address, "bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el");
    });
  });

  test("Index-based Wallet Creation Tests", async (t) => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    t.test("should generate different addresses for different indices", async (t) => {
      wallet.seedPhrase = testMnemonic;
      const wallet0 = await wallet.getAccount(0);
      const wallet1 = await wallet.getAccount(1);

      t.not(wallet0.address, wallet1.address);
      t.not(wallet0.keyPair.publicKey, wallet1.keyPair.publicKey);
      t.not(wallet0.keyPair.privateKey, wallet1.keyPair.privateKey);
    });
  });

  test("Error Handling Tests", async (t) => {
    t.test("should return false for invalid mnemonic", async (t) => {
      const result = WalletManagerBtc.isValidSeedPhrase("invalid mnemonic");
      t.is(result, false);
    });
  });
});
