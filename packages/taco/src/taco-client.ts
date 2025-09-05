/**
 * TacoClient - Object-Oriented Interface for TACo Operations
 *
 * Provides a higher-level, client-oriented abstraction over the functional TACo API.
 * This complements the existing functional API and caters to developers who prefer
 * class-based architectures.
 */

import {
  DkgPublicKey,
  initialize,
  ThresholdMessageKit,
} from '@nucypher/nucypher-core';

import {
  type TacoClientConfig,
  type TacoClientEthersConfig,
  type TacoClientViemConfig,
} from './client-config.js';
import { Condition } from './conditions/condition.js';
import { ConditionContext } from './conditions/context/index.js';
import { decrypt, encrypt, encryptWithPublicKey } from './encrypt-decrypt.js';
import {
  TacoConfigValidator,
  type ValidationResult,
} from './taco-config-validator.js';

/**
 * TacoClient provides an object-oriented interface for TACo operations
 *
 * This class encapsulates TACo configuration and provides simplified methods
 * for encryption and decryption operations. It handles configuration validation,
 * automatic WASM initialization, and provides enhanced error messages.
 *
 * **Key Features:**
 * - Automatic WASM initialization (singleton pattern)
 * - Supports both viem and ethers.js
 * - Configuration validation with helpful error messages
 * - Thread-safe initialization across multiple instances
 *
 * @example Using with viem:
 * ```typescript
 * import { TacoClient, DOMAIN_NAMES } from '@nucypher/taco';
 * import { createPublicClient, http } from 'viem';
 * import { polygonAmoy } from 'viem/chains';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * // Create viem client and account
 * const viemClient = createPublicClient({
 *   chain: polygonAmoy,
 *   transport: http()
 * });
 * const viemAccount = privateKeyToAccount('0x...');
 *
 * // Create TacoClient - WASM initializes automatically
 * const tacoClient = new TacoClient({
 *   domain: DOMAIN_NAMES.TESTNET, // 'tapir'
 *   ritualId: 6,
 *   viemClient,
 *   viemAccount
 * });
 *
 * // Operations wait for initialization automatically
 * const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
 * const decrypted = await tacoClient.decrypt(messageKit, conditionContext);
 * ```
 *
 * @example Using with ethers.js:
 * ```typescript
 * import { TacoClient, DOMAIN_NAMES } from '@nucypher/taco';
 * import { ethers } from 'ethers';
 *
 * // Create ethers provider and signer
 * const ethersProvider = new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
 * const ethersSigner = new ethers.Wallet('0x...', ethersProvider);
 *
 * // Create TacoClient - WASM initializes automatically
 * const tacoClient = new TacoClient({
 *   domain: DOMAIN_NAMES.TESTNET,
 *   ritualId: 6,
 *   ethersProvider,
 *   ethersSigner
 * });
 *
 * // Operations are safe and wait for readiness
 * const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
 * const decrypted = await tacoClient.decrypt(messageKit, conditionContext);
 * ```
 */
export class TacoClient {
  private config: TacoClientConfig;
  private static initializationPromise: Promise<void>;

  /**
   * Initialize TACo WASM globally (singleton pattern)
   *
   * This method ensures TACo WASM is initialized exactly once across all TacoClient instances.
   * Initialization happens automatically when creating clients or calling operations, but you can
   * call this explicitly for performance optimization or error handling.
   *
   * @returns {Promise<void>} Promise that resolves when TACo WASM is initialized
   *
   * @example
   * ```typescript
   * // Optional: Pre-initialize for better performance
   * await TacoClient.initialize();
   *
   * // All TacoClient instances share the same initialization
   * const client1 = new TacoClient(config1);
   * const client2 = new TacoClient(config2);
   *
   * // Operations automatically wait for initialization
   * const encrypted = await client1.encrypt(data, condition);
   * ```
   */
  static async initialize(): Promise<void> {
    if (!TacoClient.initializationPromise) {
      TacoClient.initializationPromise = (async () => {
        try {
          await initialize();
        } catch (error) {
          console.error(`TACo initialization failed: ${error}`);
          throw error; // Re-throw to maintain error propagation
        }
      })();
    }
    return TacoClient.initializationPromise;
  }

  /**
   * Create a new TacoClient instance
   *
   * @param config - Configuration for the TacoClient
   * @throws {Error} If configuration is invalid
   */
  constructor(config: TacoClientConfig) {
    // Validate configuration using TacoConfig
    const result = TacoConfigValidator.validateFast(config);
    if (!result.isValid) {
      throw new Error(`Invalid configuration: ${result.errors.join(', ')}`);
    }

    this.config = config;

    TacoClient.initialize();
  }

  /**
   * Fully validate the configuration including network provider checks
   *
   * This method performs comprehensive validation including:
   * - Domain and ritual ID validation
   * - Provider/signer configuration validation
   * - Network compatibility check (calls provider to verify chain ID matches domain)
   *
   * @returns {Promise<ValidationResult>} Promise resolving to validation result with isValid boolean and errors array
   *
   * @example
   * ```typescript
   * const result = await tacoClient.validateConfig();
   * if (!result.isValid) {
   *   console.error('Configuration errors:', result.errors);
   * }
   * ```
   */
  async validateConfig(): Promise<ValidationResult> {
    const validationResult = await TacoConfigValidator.validateFull(
      this.config,
    );
    if (!validationResult.isValid) {
      throw new Error(
        `Invalid configuration: ${validationResult.errors.join(', ')}`,
      );
    }
    return validationResult;
  }

  /**
   * Encrypt data with the given access condition
   *
   * @param data - String or Uint8Array to encrypt
   * @param accessCondition - Access condition for decryption
   * @returns {Promise<ThresholdMessageKit>} Encrypted message kit
   *
   * @example
   * ```typescript
   * const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
   * ```
   */
  async encrypt(
    data: string | Uint8Array,
    accessCondition: Condition,
  ): Promise<ThresholdMessageKit> {
    await TacoClient.initialize();

    try {
      const messageKit = await encrypt(
        (this.config as TacoClientEthersConfig).ethersProvider ||
          (this.config as TacoClientViemConfig).viemClient,
        this.config.domain,
        data,
        accessCondition,
        this.config.ritualId,
        (this.config as TacoClientEthersConfig).ethersSigner ||
          (this.config as TacoClientViemConfig).viemAccount,
      );

      return messageKit;
    } catch (error) {
      throw new Error(`TACo encryption failed: ${error}`);
    }
  }

  /**
   * Encrypt data with a provided DKG public key under a specified condition
   *
   * This method can be used offline since it doesn't require network access to fetch
   * the DKG public key (unlike the `encrypt` method which fetches it from the ritual).
   *
   * @param data - String or Uint8Array to encrypt
   * @param accessCondition - Access condition for decryption
   * @param dkgPublicKey - The DKG public key to use for encryption
   * @returns {Promise<ThresholdMessageKit>} Encrypted message kit
   *
   * @example
   * ```typescript
   * // Get DKG public key from ritual or cache
   * const dkgPublicKey = await getDkgPublicKey(domain, ritualId);
   *
   * // Encrypt offline using the public key
   * const messageKit = await tacoClient.encryptWithPublicKey('Hello, secret!', condition, dkgPublicKey);
   * ```
   */
  async encryptWithPublicKey(
    data: string | Uint8Array,
    accessCondition: Condition,
    dkgPublicKey: DkgPublicKey,
  ): Promise<ThresholdMessageKit> {
    await TacoClient.initialize();

    try {
      const messageKit = await encryptWithPublicKey(
        data,
        accessCondition,
        dkgPublicKey,
        (this.config as TacoClientEthersConfig).ethersSigner ||
          (this.config as TacoClientViemConfig).viemAccount,
      );

      return messageKit;
    } catch (error) {
      throw new Error(`TACo encryption with public key failed: ${error}`);
    }
  }

  /**
   * Decrypt data using TACo
   *
   * @param encryptedData - Either a ThresholdMessageKit or encrypted bytes (Uint8Array)
   * @param conditionContext - Optional condition context for time-based conditions
   * @returns {Promise<Uint8Array>} Decrypted data
   *
   * @example
   * ```typescript
   * // With messageKit
   * const decrypted = await tacoClient.decrypt(messageKit, conditionContext);
   *
   * // With encrypted bytes
   * const decrypted = await tacoClient.decrypt(encryptedBytes, conditionContext);
   * ```
   */
  async decrypt(
    encryptedData: ThresholdMessageKit | Uint8Array,
    conditionContext?: ConditionContext,
  ): Promise<Uint8Array> {
    await TacoClient.initialize();

    // Handle both messageKit and encrypted bytes
    const messageKit =
      encryptedData instanceof ThresholdMessageKit
        ? encryptedData
        : ThresholdMessageKit.fromBytes(encryptedData);

    try {
      const decrypted = await decrypt(
        (this.config as TacoClientEthersConfig).ethersProvider ||
          (this.config as TacoClientViemConfig).viemClient,
        this.config.domain,
        messageKit,
        conditionContext,
        this.config.porterUris,
      );

      return decrypted;
    } catch (error) {
      throw new Error(`TaCo decryption failed: ${error}`);
    }
  }

  /**
   * Get current client configuration
   *
   * @returns {Readonly<TacoClientConfig>} Client configuration
   */
  getConfig(): Readonly<TacoClientConfig> {
    return Object.freeze({ ...this.config });
  }
}
