## API Documentation

### Constructor
- **Description**: Initializes a new instance of the `WalletManagerBtc` class.
- **Parameters**:
  - `seedPhrase` (string): seed phrase of account
  - `config` (Object, optional): Configuration options for the `WalletManagerBtc` instance.
    - `network` (string, optional): The Bitcoin network to use (e.g., 'regtest', 'bitcoin'). Defaults to `bitcoin`.
    - `host` (string, optional): The Electrum server hostname. Defaults to 'electrum.blockstream.info'.
    - `port` (number, optional): The Electrum server port. Defaults to 50001.
- **Returns**: A new `WalletManagerBtc` instance.

#### static getRandomSeedPhrase
- **Description**: Returns a random BIP-39 seed phrase.
- **Parameters**: None
- **Returns**: `string`: The seed phrase.

#### static isValidSeedPhrase
- **Description**: Checks if a seed phrase is valid.
- **Parameters**:
  - `seedPhrase` (string): The seed phrase.
- **Returns**: `boolean`: True if the seed phrase is valid.

#### getAccount
- **Description**: Returns the wallet account at a specific index (see [BIP-44](https://en.bitcoin.it/wiki/BIP_0044)).
- **Parameters**:
  - `index` (number, optional): The index of the account to get. Defaults to 0.
- **Returns**: `Promise<BitcoinAccount>`

  - `publicKey` (string): The public key in hex format.
    - `privateKey` (string): The private key in WIF format.

### WalletAccountBtc

#### Constructor
- **Description**: Initializes a new instance of the `WalletAccountBtc` class.
- **Parameters**:
  - `config` (Object): Configuration options for the `WalletAccountBtc` instance.
    - `electrumClient` (ElectrumClient): The Electrum client instance.
    - `network` (Object): The Bitcoin network to use (e.g., `networks.regtest`, `networks.bitcoin`).
    - `max_fee_limit` (number, optional): The maximum fee limit. Defaults to 100000.
    - `bip32` (Object): The BIP32 instance.
    - `path` (string, optional): The derivation path of this account (see BIP-44). Defaults to ''.
    - `index` (number, optional): The derivation path's index of this account. Defaults to 0.
    - `address` (string, optional): The account's address. Defaults to ''.
    - `keyPair` (Object, optional): The account's key pair. Defaults to {}.
      - `publicKey` (string): The public key in hex format.
      - `privateKey` (string): The private key in WIF format.
- **Returns**: A new `WalletAccountBtc` instance.

#### Methods

##### sign
- **Description**: Signs a message.
- **Parameters**:
  - `message` (string): The message to sign.
- **Returns**: `Promise<string>`: The message's signature.

##### verify
- **Description**: Verifies a message signature.
- **Parameters**:
  - `message` (string): The message to verify.
  - `signature` (string): The signature to verify.
- **Returns**: `Promise<boolean>`: True if the signature is valid, false otherwise.

##### sendTransaction
- **Description**: Sends a transaction.
- **Parameters**:
  - `options` (Object): The transaction options.
    - `to` (string): The recipient address.
    - `value` (number): The amount to send in bitcoin.
- **Returns**: `Promise<String>`: The transaction txid.
