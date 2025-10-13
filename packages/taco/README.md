# `@nucypher/taco`

### [`nucypher/taco-web`](../../README.md)

## Supported `taco` versions

To use `taco`, you need to connect with a proper network: `mainnet`, `testnet`, or `devnet`. You can find a proper version for each network in the [npmjs.com package tags](https://www.npmjs.com/package/@nucypher/taco?activeTab=versions).

Visit [our documentation](https://docs.taco.build/taco-integration/) to learn more.

## Usage

First, install the package:

```bash
$ yarn add @nucypher/taco ethers@5.7.2
```

### Encrypt your data

```typescript
import { conditions, domains, encrypt, initialize } from '@nucypher/taco';
import { ethers } from 'ethers';

// We have to initialize the TACo library first
await initialize();

const web3Provider = new ethers.providers.Web3Provider(window.ethereum);

const ownsNFT = new conditions.predefined.ERC721Ownership({
  contractAddress: '0x1e988ba4692e52Bc50b375bcC8585b95c48AaD77',
  parameters: [3591],
  chain: 5,
});

const message = 'my secret message';

const messageKit = await encrypt(
  web3Provider,
  domains.TESTNET,
  message,
  ownsNFT,
  ritualId,
  web3Provider.getSigner(),
);
```

### Decrypt your data

```typescript
import { decrypt, domains, getPorterUri, initialize } from '@nucypher/taco';
import { ethers } from 'ethers';

// We have to initialize the TACo library first
await initialize();

const web3Provider = new ethers.providers.Web3Provider(window.ethereum);

const decryptedMessage = await decrypt(
  web3Provider,
  domains.TESTNET,
  messageKit,
  web3Provider.getSigner(),
);
```

## Viem Support

The TACo SDK supports both [ethers.js](https://docs.ethers.org/) natively, and [viem](https://viem.sh). The same `encrypt` and `decrypt` functions work with both libraries. Here is how to use them with viem:

```bash
$ yarn add @nucypher/taco viem
```

```typescript
import { encrypt, decrypt, conditions, domains, initialize } from '@nucypher/taco';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';

// Initialize TACo
await initialize();

const viemClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(),
});
const viemAccount = privateKeyToAccount('0x...');

const ownsNFT = new conditions.predefined.ERC721Ownership({
  contractAddress: '0x1e988ba4692e52Bc50b375bcC8585b95c48AaD77',
  parameters: [3591],
  chain: 5,
});

// Same function names work with viem - TypeScript automatically selects the right overload
const messageKit = await encrypt(
  viemClient,        // viem PublicClient
  domains.TESTNET,
  'my secret message',
  ownsNFT,
  ritualId,
  viemAccount,       // viem Signer Account (`LocalAccount` or `WalletClient`)
);

// Decrypt with viem
const decryptedMessage = await decrypt(
  viemClient,
  domains.TESTNET,
  messageKit,
);
```

### Automatic Library Detection

TypeScript automatically detects which library objects you're passing and works seamlessly:

```typescript
// Using ethers.js - automatically uses ethers implementation
const ethersEncrypted = await encrypt(
  ethersProvider,    // ethers.providers.Provider
  domains.TESTNET,
  message,
  condition,
  ritualId,
  ethersSigner       // ethers.Signer
);

// Using viem - automatically uses viem implementation  
const viemEncrypted = await encrypt(
  publicClient,  // viem PublicClient
  domains.TESTNET,
  message,
  condition,
  ritualId,
  viemAccount        // viem Signer Account (`LocalAccount` or `WalletClient`)
);
```

For detailed viem documentation, see [VIEM_SUPPORT.md](./VIEM_SUPPORT.md).

## AccessClient - Object-Oriented Interface

For applications requiring multiple TACo operations or complex configuration management, the TACo SDK provides an optional object-oriented interface through the `AccessClient` class. This provides a stateful, higher-level abstraction over the functional API.

The Object-Oriented API is fully backward compatible - you can use both APIs in
the same application as needed. Except that the AccessClient has additional validations
and hence throws some errors earlier with different error messages.

NOTE: Using `AccessClient` is equivalent to using the functional API. 
There are no specific recommendations on which approach to use. 
Choose the one that best suits your development preferences.

### Basic Usage

```typescript
import { AccessClient, ConditionContext, DOMAIN_NAMES } from '@nucypher/taco';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';

// Initialize TACo
await initialize();

// Set up viem client and account
const viemClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(),
});
const viemAccount = privateKeyToAccount('0x...');

// Create AccessClient instance with domain constants
const accessClient = new AccessClient({
  domain: DOMAIN_NAMES.TESTNET, // TESTNET -> 'tapir'
  ritualId: 6,
  viemClient,
  viemAccount
});

// Encrypt data
const messageKit = await accessClient.encrypt('Hello, secret!', condition);

// Decrypt
const conditionContext = ConditionContext.fromMessageKit(messageKit);

// if needed Add authentication for ":userAddress" in condition...

const decryptedMessage = await accessClient.decrypt(messageKit, conditionContext);
// OR with encrypted bytes:
// const decryptedMessage = await accessClient.decrypt(messageKit.toBytes(), conditionContext);
```

### Dual Configuration Support

AccessClient supports both viem and ethers.js configurations:

```typescript
import { AccessClient, DOMAIN_NAMES } from '@nucypher/taco';

// With viem
const accessClientViem = new AccessClient({
  domain: DOMAIN_NAMES.TESTNET,
  ritualId: 6,
  viemClient,
  viemAccount
});

// With ethers.js
const accessClientEthers = new AccessClient({
  domain: DOMAIN_NAMES.TESTNET,
  ritualId: 6,
  ethersProvider,
  ethersSigner
});
```

## Learn more

Please find developer documentation for
TACo [here](https://docs.taco.build/).
