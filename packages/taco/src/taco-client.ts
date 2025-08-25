/**
 * TacoClient - Object-Oriented Interface for TACo Operations
 *
 * Provides a higher-level, client-oriented abstraction over the functional TACo API.
 * This complements the existing functional API and caters to developers who prefer
 * class-based architectures.
 */

import { ThresholdMessageKit } from '@nucypher/nucypher-core';

import {
  isEthersConfig,
  isViemConfig,
  type TacoClientConfig,
} from './client-config';
import { Condition } from './conditions/condition';
import { ConditionContext } from './conditions/context';
import { decrypt, encrypt } from './encrypt-decrypt';
import {
  TacoConfigValidator,
  type ValidationResult,
} from './taco-config-validator';

/**
 * TacoClient provides an object-oriented interface for TACo operations
 *
 * This class encapsulates TACo configuration and provides simplified methods
 * for encryption and decryption operations. It handles configuration validation,
 * auto-correction, and provides enhanced error messages.
 *
 * Supports both viem and ethers.js for maximum flexibility.
 *
 * @example Using with viem:
 * ```typescript
 * import { TacoClient, TacoConfig } from '@nucypher/taco';
 * import { createPublicClient, http } from 'viem';
 * import { polygonAmoy } from 'viem/chains';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * // Process and validate configuration
 * const processedConfig = TacoConfig.process({
 *   domain: 'testnet',  // Will be auto-corrected to 'TESTNET'
 *   // ritualId automatically set to default for TESTNET (6)
 * });
 *
 * // Create viem client and account
 * const viemClient = createPublicClient({
 *   chain: polygonAmoy,
 *   transport: http()
 * });
 * const viemAccount = privateKeyToAccount('0x...');
 *
 * // Create TacoClient instance with viem
 * const tacoClient = new TacoClient({
 *   ...processedConfig,
 *   viemClient,
 *   viemAccount
 * });
 *
 * // Simple encryption/decryption
 * const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
 * const context = await tacoClient.createConditionContext(messageKit);
 * const decrypted = await tacoClient.decrypt(messageKit, context);
 * ```
 *
 * @example Using with ethers.js:
 * ```typescript
 * import { TacoClient, TacoConfig } from '@nucypher/taco';
 * import { ethers } from 'ethers';
 *
 * // Process and validate configuration
 * const processedConfig = TacoConfig.process({
 *   domain: 'testnet',
 *   ritualId: 6
 * });
 *
 * // Create ethers provider and signer
 * const ethersProvider = new ethers.providers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
 * const ethersSigner = new ethers.Wallet('0x...', ethersProvider);
 *
 * // Create TacoClient instance with ethers
 * const tacoClient = new TacoClient({
 *   ...processedConfig,
 *   ethersProvider,
 *   ethersSigner
 * });
 *
 * // Simple encryption/decryption
 * const messageKit = await tacoClient.encrypt('Hello, secret!', condition);
 * const context = await tacoClient.createConditionContext(messageKit);
 * const decrypted = await tacoClient.decrypt(messageKit, context);
 * ```
 */
export class TacoClient {
  private config: TacoClientConfig;

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

    console.debug(`TacoClient initialized`, {
      domain: this.config.domain,
      ritualId: this.config.ritualId,
    });
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
    console.debug('Starting encryption', {
      domain: this.config.domain,
      ritualId: this.config.ritualId,
      dataType: typeof data,
      dataLength: data.length,
    });

    try {
      let messageKit: ThresholdMessageKit;

      if (isViemConfig(this.config)) {
        // Use viem API
        messageKit = await encrypt(
          this.config.viemClient,
          this.config.domain,
          data,
          accessCondition,
          this.config.ritualId,
          this.config.viemAccount,
        );
      } else if (isEthersConfig(this.config)) {
        // Use ethers API
        messageKit = await encrypt(
          this.config.ethersProvider,
          this.config.domain,
          data,
          accessCondition,
          this.config.ritualId,
          this.config.ethersSigner,
        );
      } else {
        throw new Error(
          'Invalid configuration: must provide either viem or ethers objects',
        );
      }

      console.info('Encryption successful');
      return messageKit;
    } catch (error) {
      throw new Error(`TaCo encryption failed: ${error}`);
    }
  }

  /**
   * Decrypt a message kit with optional condition context
   *
   * @param messageKit - Encrypted message kit
   * @param conditionContext - Optional condition context for time-based conditions
   * @returns {Promise<Uint8Array>} Decrypted data
   *
   * @example
   * ```typescript
   * const decrypted = await tacoClient.decrypt(messageKit, conditionContext);
   * ```
   */
  async decrypt(
    messageKit: ThresholdMessageKit,
    conditionContext?: ConditionContext,
  ): Promise<Uint8Array> {
    console.debug('Starting decryption', {
      domain: this.config.domain,
      hasContext: !!conditionContext,
    });

    try {
      let decrypted: Uint8Array;

      if (isViemConfig(this.config)) {
        // Use viem API
        decrypted = await decrypt(
          this.config.viemClient,
          this.config.domain,
          messageKit,
          conditionContext,
          this.config.porterUris,
        );
      } else if (isEthersConfig(this.config)) {
        // Use ethers API
        decrypted = await decrypt(
          this.config.ethersProvider,
          this.config.domain,
          messageKit,
          conditionContext,
          this.config.porterUris,
        );
      } else {
        throw new Error(
          'Invalid configuration: must provide either viem or ethers objects',
        );
      }

      console.info('Decryption successful');
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
