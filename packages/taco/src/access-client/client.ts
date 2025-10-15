import {
  DkgPublicKey,
  initialize,
  ThresholdMessageKit,
} from '@nucypher/nucypher-core';

import { Condition } from '../conditions/condition.js';
import { ConditionContext } from '../conditions/context/index.js';
import { decrypt, encrypt, encryptWithPublicKey } from '../taco.js';

import { AccessConfigValidator } from './config-validator.js';
import {
  type AccessClientConfig,
  type AccessClientEthersConfig,
  type AccessClientViemConfig,
} from './config.js';

/**
 * AccessClient provides an object-oriented interface for TACo cryptographic operations
 *
 * This class encapsulates TACo access-control configuration and provides simplified methods
 * for encryption and decryption operations. It handles configuration validation,
 * automatic WASM initialization, and provides enhanced error messages.
 *
 * @example Using with viem:
 * ```typescript
 * import { AccessClient, DOMAIN_NAMES } from '@nucypher/taco';
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
 * // Create AccessClient - WASM initializes automatically
 * const accessClient = new AccessClient({
 *   domain: DOMAIN_NAMES.TESTNET, // 'tapir'
 *   ritualId: 6,
 *   viemClient,
 *   viemAccount
 * });
 *
 * // Operations wait for initialization automatically
 * const messageKit = await accessClient.encrypt('Hello, secret!', condition);
 * const decrypted = await accessClient.decrypt(messageKit, conditionContext);
 * ```
 *
 * @example Using with ethers.js:
 * ```typescript
 * import { AccessClient, DOMAIN_NAMES } from '@nucypher/taco';
 * import { ethers } from 'ethers';
 *
 * // Create ethers provider and signer
 * const ethersProvider = new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
 * const ethersSigner = new ethers.Wallet('0x...', ethersProvider);
 *
 * // Create AccessClient - WASM initializes automatically
 * const accessClient = new AccessClient({
 *   domain: DOMAIN_NAMES.TESTNET,
 *   ritualId: 6,
 *   ethersProvider,
 *   ethersSigner
 * });
 *
 * // Operations are safe and wait for readiness
 * const messageKit = await accessClient.encrypt('Hello, secret!', condition);
 * const decrypted = await accessClient.decrypt(messageKit, conditionContext);
 * ```
 */
export class AccessClient {
  private config: AccessClientConfig;
  private static initializationPromise: Promise<void>;

  /**
   * Initialize TACo WASM globally (singleton pattern)
   *
   * This method ensures TACo WASM is initialized exactly once across all AccessClient instances.
   * Initialization happens automatically when creating clients or calling operations, but you can
   * call this explicitly for performance optimization or error handling.
   *
   * @returns {Promise<void>} Promise that resolves when TACo WASM is initialized
   *
   * @example
   * ```typescript
   * // Optional: Pre-initialize for better performance
   * await AccessClient.initialize();
   *
   * // All AccessClient instances share the same initialization
   * const client1 = new AccessClient(config1);
   * const client2 = new AccessClient(config2);
   *
   * // Operations automatically wait for initialization
   * const encrypted = await client1.encrypt(data, condition);
   * ```
   */
  static async initialize(): Promise<void> {
    if (!AccessClient.initializationPromise) {
      AccessClient.initializationPromise = (async () => {
        try {
          await initialize();
        } catch (error) {
          console.error(`TACo initialization failed: ${error}`);
          throw error; // Re-throw to maintain error propagation
        }
      })();
    }
    return AccessClient.initializationPromise;
  }

  /**
   * Create a new AccessClient instance
   *
   * @param {AccessClientConfig} config - Configuration for the AccessClient
   * @throws {Error} If configuration is invalid
   */
  constructor(config: AccessClientConfig) {
    // Validate configuration using AccessConfig
    const result = AccessConfigValidator.validateFast(config);
    if (!result.isValid) {
      throw new Error(`Invalid configuration: ${result.errors.join(', ')}`);
    }

    this.config = config;

    AccessClient.initialize();
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
   * @throws {Error} If configuration validation fails
   *
   * @example
   * ```typescript
   * try {
   *   await accessClient.validateConfig();
   *   console.log('Configuration is valid.');
   * } catch (error) {
   *   console.error('Configuration validation failed:', error.message);
   * }
   * ```
   */
  async validateConfig(): Promise<void> {
    const validationResult = await AccessConfigValidator.validate(this.config);
    if (!validationResult.isValid) {
      throw new Error(
        `Invalid configuration: ${validationResult.errors.join(', ')}`,
      );
    }
  }

  /**
   * Encrypt data with the given access condition
   *
   * @param {string | Uint8Array} data - String or Uint8Array to encrypt
   * @param {Condition} accessCondition - Access condition for decryption
   * @returns {Promise<ThresholdMessageKit>} Encrypted message kit
   * @throws {Error} If encryption fails
   *
   * @example
   * ```typescript
   * const messageKit = await accessClient.encrypt('Hello, secret!', condition);
   * ```
   */
  async encrypt(
    data: string | Uint8Array,
    accessCondition: Condition,
  ): Promise<ThresholdMessageKit> {
    await AccessClient.initialize();

    const messageKit = await encrypt(
      (this.config as AccessClientEthersConfig).ethersProvider ||
        (this.config as AccessClientViemConfig).viemClient,
      this.config.domain,
      data,
      accessCondition,
      this.config.ritualId,
      (this.config as AccessClientEthersConfig).ethersSigner ||
        (this.config as AccessClientViemConfig).viemSignerAccount,
    );

    return messageKit;
  }

  /**
   * Encrypt data with a provided DKG public key under a specified condition
   *
   * This method can be used offline since it doesn't require network access to fetch
   * the DKG public key (unlike the `encrypt` method which fetches it from the ritual).
   *
   * @param {string | Uint8Array} data - String or Uint8Array to encrypt
   * @param {Condition} accessCondition - Access condition for decryption
   * @param {DkgPublicKey} dkgPublicKey - The DKG public key to use for encryption
   * @returns {Promise<ThresholdMessageKit>} Encrypted message kit
   * @throws {Error} If encryption fails
   *
   * @example
   * ```typescript
   * // Get DKG public key from ritual or cache
   * const dkgPublicKey = await getDkgPublicKey(domain, ritualId);
   *
   * // Encrypt offline using the public key
   * const messageKit = await accessClient.encryptWithPublicKey('Hello, secret!', condition, dkgPublicKey);
   * ```
   */
  async encryptWithPublicKey(
    data: string | Uint8Array,
    accessCondition: Condition,
    dkgPublicKey: DkgPublicKey,
  ): Promise<ThresholdMessageKit> {
    await AccessClient.initialize();

    const messageKit = await encryptWithPublicKey(
      data,
      accessCondition,
      dkgPublicKey,
      (this.config as AccessClientEthersConfig).ethersSigner ||
        (this.config as AccessClientViemConfig).viemSignerAccount,
    );

    return messageKit;
  }

  /**
   * Decrypt data using TACo
   *
   * @param {ThresholdMessageKit | Uint8Array} encryptedData - Either a ThresholdMessageKit or encrypted bytes (Uint8Array)
   * @param {ConditionContext} [conditionContext] - Optional condition context for time-based conditions
   * @returns {Promise<Uint8Array>} Decrypted data
   * @throws {Error} If decryption fails
   *
   * @example
   * ```typescript
   * // With messageKit
   * const decrypted = await accessClient.decrypt(messageKit, conditionContext);
   *
   * // With encrypted bytes
   * const decrypted = await accessClient.decrypt(encryptedBytes, conditionContext);
   * ```
   */
  async decrypt(
    encryptedData: ThresholdMessageKit | Uint8Array,
    conditionContext?: ConditionContext,
  ): Promise<Uint8Array> {
    await AccessClient.initialize();

    // Handle both messageKit and encrypted bytes
    const messageKit =
      encryptedData instanceof ThresholdMessageKit
        ? encryptedData
        : ThresholdMessageKit.fromBytes(encryptedData);

    const decrypted = await decrypt(
      (this.config as AccessClientEthersConfig).ethersProvider ||
        (this.config as AccessClientViemConfig).viemClient,
      this.config.domain,
      messageKit,
      conditionContext,
      this.config.porterUris,
    );

    return decrypted;
  }

  /**
   * Get current client configuration
   *
   * @returns {Readonly<AccessClientConfig>} Client configuration
   */
  getConfig(): Readonly<AccessClientConfig> {
    return Object.freeze({ ...this.config });
  }
}
