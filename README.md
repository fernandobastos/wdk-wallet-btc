## API Documentation

### Constructor
- **Description**: Initializes a new instance of the BTCAccount class.
- **Parameters**:
  - `config` (Object, optional): Configuration options for the BTCAccount instance.
    - `network` (string | object, optional): The Bitcoin network to use (e.g., 'regtest', 'bitcoin'). Defaults to `bitcoin.networks.bitcoin` (mainnet).
    - `host` (string, optional): The Electrum server hostname. Defaults to 'electrum.blockstream.info'.
    - `port` (number, optional): The Electrum server port. Defaults to 50001.
    - `protocol` (string, optional): The Electrum server protocol ('tcp' or 'tls'). Defaults to 'tcp'.
- **Returns**: A new BTCAccount instance.

### init
- **Description**: Initializes the WASM module required for BIP32 functionality.
- **Parameters**: None
- **Returns**: `Promise<void>`

### connect
- **Description**: Establishes a connection to the Electrum server.
- **Parameters**: None
- **Returns**: `Promise<boolean>`: A promise that resolves to `true` if the connection is successful.

### disconnect
- **Description**: Closes the connection to the Electrum server.
- **Parameters**: None
- **Returns**: `Promise<void>`

### createWallet
- **Description**: Creates a new random HD wallet.
- **Parameters**: None
- **Returns**: `Promise<Object>`: A promise that resolves to a new HD wallet instance with the following properties:
  - `mnemonic` (string): The mnemonic phrase for the wallet.
  - `address` (string): The Bitcoin address.
  - `publicKey` (string): The public key.
  - `privateKey` (string): The private key.
  - `derivationPath` (string): The derivation path used.
- **Throws**:
  - `Error`: If wallet creation fails.

### restoreWalletFromPhrase
- **Description**: Restores a wallet from a mnemonic phrase.
- **Parameters**:
  - `mnemonic` (string): The mnemonic phrase to restore from.
- **Returns**: `Promise<Object>`: A promise that resolves to the restored wallet details with the following properties:
  - `mnemonic` (string): The mnemonic phrase for the wallet.
  - `address` (string): The Bitcoin address.
  - `publicKey` (string): The public key.
  - `privateKey` (string): The private key.
  - `derivationPath` (string): The derivation path used.
- **Throws**:
  - `Error`: If the mnemonic phrase is invalid.

### derivePrivateKeysFromPhrase
- **Description**: Derives private keys from a mnemonic phrase using a specific derivation path.
- **Parameters**:
  - `mnemonic` (string): The mnemonic phrase to restore from.
- **Returns**: `Promise<Object>`: A promise that resolves to an object containing the derived private and public keys:
  - `privateKey` (string): The derived private key.
  - `publicKey` (string): The corresponding public key.
- **Throws**:
  - `Error`: If the mnemonic phrase is invalid.

### createWalletByIndex
- **Description**: Creates a new wallet by index.
- **Parameters**:
  - `mnemonic` (string): The mnemonic phrase to restore from.
  - `index` (number, optional): The index to derive the path from. Defaults to 0.
- **Returns**: `Promise<Object>`: A promise that resolves to the restored wallet details with the following properties:
  - `mnemonic` (string): The mnemonic phrase for the wallet.
  - `address` (string): The Bitcoin address.
  - `publicKey` (string): The public key.
  - `privateKey` (string): The private key in WIF format.
  - `derivationPath` (string): The derivation path used.
- **Returns**: `null` if the mnemonic is invalid.

### send
- **Description**: Sends a Bitcoin transaction.
- **Parameters**:
  - `sender` (Object): Sender details.
    - `mnemonic` (string): The sender's mnemonic phrase.
  - `recipient` (string): The recipient's Bitcoin address.
  - `amount` (number): The amount to send in BTC.
- **Returns**: `Promise<Object>`: A promise that resolves to the transaction details.
  - `txid` (string): The transaction ID.
  - `hex` (string): The raw transaction hex.
- **Throws**:
  - `Error`: If the transaction fails to broadcast.

### btcToSats
- **Description**: Converts BTC to satoshis.
- **Parameters**:
  - `btc` (number): The amount in BTC.
- **Returns**: `number`: The equivalent amount in satoshis.

### satsToBtc
- **Description**: Converts satoshis to BTC.
- **Parameters**:
  - `satoshi` (number): The amount in satoshis.
- **Returns**: `number`: The equivalent amount in BTC.
