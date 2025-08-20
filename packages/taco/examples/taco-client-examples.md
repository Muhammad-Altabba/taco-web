# TacoClient Examples

This document demonstrates how to use the new Object-Oriented TacoClient
interface.

## Basic Usage

### 1. Import Required Dependencies

```typescript
import { TacoClient, TacoConfig } from '@nucypher/taco';
import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as conditions from '@nucypher/taco/conditions';
```

### 2. Configuration Processing

```typescript
// Process user configuration with auto-correction and validation
const userConfig = {
  domain: 'testnet', // Will be auto-corrected to 'TESTNET'
  // ritualId is automatically set to default for TESTNET (6)
};

const processedConfig = TacoConfig.process(userConfig);
console.log(processedConfig);
// Output: { domain: 'TESTNET', ritualId: 6, chainId: 80002, rpcUrl: '...' }
```

### 3. Create TacoClient Instance

```typescript
// Create viem client for Polygon Amoy (TACo network)
const viemClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(),
});

// Create account from private key
const viemAccount = privateKeyToAccount('0x...');

// Create TacoClient with processed configuration
const tacoClient = new TacoClient({
  ...processedConfig,
  viemClient,
  viemAccount,
});
```

### 4. Encrypt and Decrypt Data

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

// Decrypt with automatic context creation
const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
const message = new TextDecoder().decode(decrypted);
console.log(message); // "Hello, secret world!"
```

## Advanced Usage

### 1. Domain Configuration Management

```typescript
// Get domain information
const domainInfo = tacoClient.getDomainInfo();
console.log(domainInfo);
// Output: {
//   domain: 'TESTNET',
//   alias: 'tapir',
//   chainId: 80002,
//   rituals: [6],
//   suggestedRpcUrls: ['https://rpc-amoy.polygon.technology', ...],
//   isProduction: false
// }

// Get supported domains
const domains = TacoConfig.getSupportedDomains();
console.log(domains); // ['DEVNET', 'TESTNET', 'MAINNET']

// Validate domain and ritual combinations
const isValid = TacoConfig.isValidRitualId('TESTNET', 6);
console.log(isValid); // true
```

### 2. Configuration Validation

```typescript
// Validate configuration before creating client
const validation = TacoConfig.validate({
  domain: 'INVALID_DOMAIN',
  ritualId: 999,
});

if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  // Output: ['Invalid domain: INVALID_DOMAIN. Supported: DEVNET, TESTNET, MAINNET']
}
```

### 3. Multiple Clients for Different Contexts

```typescript
// Development client
const devConfig = TacoConfig.process({ domain: 'devnet' });
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

### 4. Custom Condition Context

```typescript
// Create custom condition context for complex decryption scenarios
const messageKit = await tacoClient.encrypt(data, condition);

// Method 1: Use auto context (recommended for most cases)
const decrypted1 = await tacoClient.decryptWithAutoContext(messageKit);

// Method 2: Create custom context
const conditionContext = await tacoClient.createConditionContext(messageKit);
// Add custom context parameters if needed
// conditionContext.addCustomContextParameterValues({...});

const decrypted2 = await tacoClient.decrypt(messageKit, conditionContext);
```

### 5. Error Handling and Logging

```typescript
import { Logger, LogLevel } from '@nucypher/taco';

// Create client with debug logging
const tacoClient = new TacoClient({
  ...processedConfig,
  viemClient,
  viemAccount,
  logLevel: LogLevel.DEBUG, // or provide your own logger with: `logger: new Logger(LogLevel.DEBUG)`
});

try {
  const messageKit = await tacoClient.encrypt(data, condition);
  const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
} catch (error) {
  console.error('TaCo operation failed:', error.message);
  // Error messages include context about the configuration and operation
}
```

## Migration from Functional API

### Before (Functional API)

#### With viem

```typescript
import { encryptWithViem, decryptWithViem, domains } from '@nucypher/taco';

const messageKit = await encryptWithViem(
  viemClient, // pass viem client when calling encrypt and when calling decrypt
  domains.TESTNET, // Accepts any arbitrary string
  'Hello, secret!',
  condition,
  6, // Must remember the corresponding ritual ID for DEVNET and TESTNET
  viemAccount,
);

const decrypted = await decryptWithViem(
  viemClient, // pass viem client when calling encrypt and when calling decrypt
  domains.TESTNET, // Accepts any arbitrary string. And need to be passed at both encrypt and decrypt
  messageKit,
  conditionContext,
);
```

#### With ethers.js

```typescript
import { encrypt, decrypt, domains } from '@nucypher/taco';

const messageKit = await encrypt(
  ethersProvider, // pass ethers provider when calling encrypt and when calling decrypt
  domains.TESTNET, // Accepts any arbitrary string
  'Hello, secret!',
  condition,
  6, // Must remember the corresponding ritual ID for DEVNET and TESTNET
  ethersSigner,
);

const decrypted = await decrypt(
  ethersProvider, // pass ethers provider when calling encrypt and when calling decrypt
  domains.TESTNET, // Accepts any arbitrary string. And need to be passed at both encrypt and decrypt
  messageKit,
  conditionContext,
);
```

### After (Object-Oriented API)

#### With viem

```typescript
import { TacoClient, TacoConfig } from '@nucypher/taco';

// One-time setup with validation
// processedConfig will have the default ritual ID for TESTNET (6)
const processedConfig = TacoConfig.process({ domain: 'testnet' }); // same as: `TacoConfig.process({ domain: 'tapir' });`

// For mainnet, you need to specify the ritual ID explicitly like:
const processedConfigMainnet = TacoConfig.process({
  domain: 'mainnet',
  ritualId: 42,
});

const tacoClient = new TacoClient({
  ...processedConfig,
  viemClient,
  viemAccount,
});

// Simplified operations - no need to pass configuration repeatedly
// The encrypt and decrypt methods are unified between viem and ethers.js
const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
```

#### With ethers.js

```typescript
import { TacoClient, TacoConfig } from '@nucypher/taco';

// One-time setup with validation
// processedConfig will have the default ritual ID for TESTNET (6)
const processedConfig = TacoConfig.process({ domain: 'testnet' }); // same as: `TacoConfig.process({ domain: 'tapir' });`

// For mainnet, you need to specify the ritual ID explicitly like:
const processedConfigMainnet = TacoConfig.process({
  domain: 'mainnet',
  ritualId: 42,
});

const tacoClient = new TacoClient({
  ...processedConfig,
  ethersProvider,
  ethersSigner,
});

// Simplified operations - no need to pass configuration repeatedly
// The encrypt and decrypt methods are unified between viem and ethers.js
const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
```

## Benefits

1. **Reduced Boilerplate**: No need to pass domain/ritual parameters repeatedly
2. **Built-in Validation**: Automatic configuration validation and error
   handling
3. **Auto-correction**: Common mistakes like domain casing are fixed
   automatically
4. **Enhanced Logging**: Contextual error messages and debug information
5. **Type Safety**: Full TypeScript support with intelligent autocompletion
6. **Multiple Configurations**: Easy management of different TACo setups per
   application context

The Object-Oriented API is fully backward compatible - you can use both APIs in
the same application as needed.
