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

import WalletManagerBtc from "../src/walletManagerBtc";
import { payments, networks } from "bitcoinjs-lib";
import { mnemonicToSeedSync, validateMnemonic } from "bip39";
import { BIP32Factory } from "bip32";
import ecc from "@bitcoinerlab/secp256k1";

describe("WalletManagerBtc BIP84 Tests", () => {
  let wallet;

  beforeAll(async () => {
    wallet = new WalletManagerBtc();
    await wallet.init();
  });

  describe("BIP84 Derivation Path Tests", () => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    test("should generate correct BIP84 derivation path", async () => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      expect(walletAccount.path).toBe("m/84'/0'/0'/0/0");
    });

    test("should generate correct BIP84 addresses", async () => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      expect(walletAccount.address).toBe(
        "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"
      );
    });

    test("should generate correct extended public key", async () => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      expect(walletAccount.keyPair.publicKey).toBe(
        "0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c"
      );
    });

    test("should generate correct private key", async () => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(0);
      expect(walletAccount.keyPair.privateKey).toBe(
        "KyZpNDKnfs94vbrwhJneDi77V6jF64PWPF8x5cdJb8ifgg2DUc9d"
      );
    });
  });

  describe("BIP84 Receiving and Change Address Tests", () => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    test("should generate correct second receiving address (m/84'/0'/0'/0/1)", async () => {
      wallet.seedPhrase = testMnemonic;
      const walletAccount = await wallet.getAccount(1);
      expect(walletAccount.path).toBe("m/84'/0'/0'/0/1");
      expect(walletAccount.address).toBe(
        "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g"
      );
    });

    test("should generate correct first change address (m/84'/0'/0'/1/0)", async () => {
      const seed = mnemonicToSeedSync(testMnemonic);
      const root = BIP32Factory(ecc).fromSeed(seed);
      const child = root.derivePath("m/84'/0'/0'/1/0");

      const address = payments.p2wpkh({
        pubkey: child.publicKey,
        network: networks.bitcoin,
      }).address;

      expect(address).toBe("bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el");
    });
  });

  describe("Wallet Creation Tests", () => {
    test("should create a valid BIP84 wallet", async () => {
      const newWallet = await wallet.createWallet();

      expect(validateMnemonic(newWallet.mnemonic)).toBe(true);
      expect(newWallet.address.startsWith("bc1")).toBe(true);
      expect(newWallet.publicKey.length).toBe(66);
      expect(newWallet.privateKey.length).toBeLessThanOrEqual(52);
    });

    test("should restore wallet correctly from mnemonic", async () => {
      const newWallet = await wallet.createWallet();
      const restoredWallet = await wallet.restoreWalletFromPhrase(
        newWallet.mnemonic
      );

      expect(restoredWallet.address).toBe(newWallet.address);
      expect(restoredWallet.publicKey).toBe(newWallet.publicKey);
      expect(restoredWallet.privateKey).toBe(newWallet.privateKey);
    });
  });

  describe("Index-based Wallet Creation Tests", () => {
    const testMnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    test("should generate different addresses for different indices", async () => {
      wallet.seedPhrase = testMnemonic;
      const wallet0 = await wallet.getAccount(0);
      const wallet1 = await wallet.getAccount(1);

      expect(wallet0.address).not.toBe(wallet1.address);
      expect(wallet0.keyPair.publicKey).not.toBe(wallet1.publicKey);
      expect(wallet0.keyPair.privateKey).not.toBe(wallet1.privateKey);
    });
  });

  describe("Error Handling Tests", () => {
    test("should throw error for invalid mnemonic", async () => {
      const invalidMnemonic = "invalid mnemonic phrase";
      await expect(
        wallet.restoreWalletFromPhrase(invalidMnemonic)
      ).rejects.toThrow("Invalid mnemonic phrase");
    });

    test("should throw error for empty mnemonic", async () => {
      await expect(wallet.restoreWalletFromPhrase("")).rejects.toThrow(
        "Mnemonic phrase cannot be empty"
      );
    });

    test("should return false for invalid mnemonic", async () => {
      const result = wallet.isValidSeedPhrase("invalid mnemonic");
      expect(result).toBe(false);
    });
  });
});
