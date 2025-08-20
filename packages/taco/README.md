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

## TacoClient - Object-Oriented Interface

For applications requiring multiple TACo operations or complex configuration management, the TACo SDK provides an optional object-oriented interface through the `TacoClient` class. This provides a stateful, higher-level abstraction over the functional API.

### Benefits

- **Reduced Boilerplate**: No need to repeatedly pass configuration parameters
- **Built-in Validation**: Automatic configuration validation and correction
- **Better IntelliSense**: IDE autocompletion and type safety
- **Simplified Error Handling**: Contextual errors with specific recommendations
- **Stateful Configuration**: Store domain, ritual ID, and client configurations at instance level

### Basic Usage

```typescript
import { TacoClient, TacoDomains } from '@nucypher/taco';
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

// Create TacoClient instance using domain constants
const tacoClient = new TacoClient({
  domain: TacoDomains.TESTNET, // 'tapir' - use TacoDomains.DEVNET or TacoDomains.MAINNET
  ritualId: 6,
  viemClient,
  viemAccount
});

// Encrypt data
const messageKit = await tacoClient.encrypt('Hello, secret!', condition);

// Decrypt with automatic context creation
const decryptedMessage = await tacoClient.decryptWithAutoContext(messageKit);
```

### Logger Configuration

You can configure custom logging for better debugging and monitoring:

```typescript
import { TacoClient, TacoDomains, Logger, LogLevel } from '@nucypher/taco';

// Create custom logger instance
const customLogger = new Logger({
  level: LogLevel.DEBUG,
  component: 'MyApp',
});

// Use custom logger in TacoClient
const tacoClient = new TacoClient({
  domain: TacoDomains.TESTNET,
  ritualId: 6,
  viemClient,
  viemAccount,
  logger: customLogger, // Custom logger instance. You can create and provide yours.
});

// Or set log level directly (creates new Logger internally)
const tacoClientWithLogLevel = new TacoClient({
  domain: TacoDomains.TESTNET,
  ritualId: 6,
  viemClient,
  viemAccount,
  logLevel: LogLevel.WARN, // Set log level directly (creates new Logger internally that will print to console)
});
```

### Configuration Management

The `TacoConfig` class provides unified configuration management with automatic validation and correction:

```typescript
import { TacoConfig } from '@nucypher/taco';

// Auto-correct and validate configuration
const config = TacoConfig.process({ domain: 'testnet' }); // → will use 'tapir' with ritual 6
const tacoClient = new TacoClient({ 
  ...config, 
  viemClient, 
  viemAccount 
});

// Get domain information
const domainInfo = tacoClient.getDomainInfo();
// Returns: { domain, alias, chainId, rituals, suggestedRpcUrls, isProduction }

// Check supported domains
const supportedDomains = TacoConfig.getSupportedDomains(); // ['lynx', 'tapir', 'mainnet']
```

### Dual Configuration Support

TacoClient supports both viem and ethers.js configurations:

```typescript
import { TacoClient, TacoDomains } from '@nucypher/taco';

// With viem (recommended)
const tacoClientViem = new TacoClient({
  domain: TacoDomains.TESTNET,
  ritualId: 6,
  viemClient,
  viemAccount
});

// With ethers.js
const tacoClientEthers = new TacoClient({
  domain: TacoDomains.TESTNET,
  ritualId: 6,
  ethersProvider,
  ethersSigner
});
```

### Backward Compatibility

The TacoClient provides a higher-level interface while maintaining full backward compatibility:

- **Zero Breaking Changes**: Existing functional API remains unchanged
- **Optional Import**: OOP classes available as optional imports
- **Interoperable**: Can use both APIs in the same application, if needed.

## Learn more

Please find developer documentation for
TACo [here](https://docs.taco.build/).
