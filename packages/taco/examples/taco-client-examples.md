# TacoClient Examples

This document demonstrates how to use the new Object-Oriented TacoClient
interface.

## Basic Usage

### 1. Import Required Dependencies

```typescript
import { TacoClient, DOMAIN_NAMES } from '@nucypher/taco';
import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as conditions from '@nucypher/taco/conditions';
import { ConditionContext } from '@nucypher/taco';
import {
  EIP4361AuthProvider,
  USER_ADDRESS_PARAM_DEFAULT,
} from '@nucypher/taco-auth';
```

### 2. Create TacoClient Instance

```typescript
// Create viem client for Polygon Amoy (TACo network)
const viemClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(),
});

// Create account from private key
const viemAccount = privateKeyToAccount('0x...');

// Create TacoClient with configuration
const tacoClient = new TacoClient({
  domain: DOMAIN_NAMES.TESTNET, // 'tapir' - stable testnet
  ritualId: 6, // default ritual ID for TESTNET
  viemClient,
  viemAccount,
});
// Validate configuration - because this is an async operation, it needs to be awaited and it cannot be done in the constructor
// However, the constructor will also do but a fast check and throw if the configuration is invalid
await tacoClient.validateConfig();
```

### 3. Encrypt and Decrypt Data

```typescript
// Create a simple time-based condition
const condition = new conditions.predefined.ERC20Balance({
  contractAddress: '0x...',
  standardContractType: 'ERC20',
  method: 'balanceOf',
  parameters: [':userAddress'],
  returnValueTest: {
    comparator: '>=',
    value: 1000000000000000000, // 1 token
  },
});

// Encrypt data
const messageKit = await tacoClient.encrypt('Hello, secret world!', condition);

// Decrypt with explicit context creation (following security best practices)
const conditionContext = ConditionContext.fromMessageKit(messageKit);

// If your condition uses ':userAddress', add authentication:
// const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
// const authProvider = new EIP4361AuthProvider(ethersProvider, ethersProvider.getSigner());
// conditionContext.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProvider);

const decrypted = await tacoClient.decrypt(messageKit, conditionContext);
// OR with encrypted bytes:
// const decrypted = await tacoClient.decrypt(messageKit.toBytes(), conditionContext);

const message = new TextDecoder().decode(decrypted);
console.log(message); // "Hello, secret world!"
```

## Advanced Usage

### Multiple Clients for Different Contexts

```typescript
// Development client
const devConfig = TacoConfig.process({ domain: 'tapir' });
const devClient = new TacoClient({
  ...devConfig,
  viemClient: devViemClient,
  viemAccount: devAccount,
});

// Production client (requires custom ritual ID)
const prodConfig = TacoConfig.process({
  domain: 'mainnet',
  ritualId: 42, // Custom ritual ID from TACo team
});
const prodClient = new TacoClient({
  ...prodConfig,
  viemClient: prodViemClient,
  viemAccount: prodAccount,
});

// Use different clients for different environments
const devEncrypted = await devClient.encrypt('dev data', devCondition);
const prodEncrypted = await prodClient.encrypt('prod data', prodCondition);
```
