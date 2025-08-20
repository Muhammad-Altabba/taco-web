/**
 * TacoClient - Object-Oriented Interface for TACo Operations
 *
 * Provides a higher-level, client-oriented abstraction over the functional TACo API.
 * This complements the existing functional API and caters to developers who prefer
 * class-based architectures.
 */

import { ThresholdMessageKit } from '@nucypher/nucypher-core';
import { type Account, type PublicClient } from '@nucypher/shared';
import type { ethers } from 'ethers';

import { Condition } from './conditions/condition';
import { ConditionContext } from './conditions/context';
import { type DomainName, TacoConfig, ValidationResult } from './domains';
import { decrypt as ethersDecrypt, encrypt as ethersEncrypt } from './taco';
import { Logger, LogLevel } from './utils/logger';
import { decryptWithViem, encryptWithViem } from './viem-taco';

/**
 * Base configuration for TacoClient
 */
export interface TacoClientBaseConfig {
  /** TACo domain name (e.g., 'lynx', 'tapir', 'mainnet') */
  domain: DomainName;
  /** Ritual ID for the TACo operations */
  ritualId: number;
  /** Optional Porter URIs */
  porterUris?: string[];
  /** Optional Logger instance. If not provided, a new Logger will be created. */
  logger?: Logger;
  /** Optional logger configuration (ignored if logger is provided) */
  logLevel?: LogLevel;
}

/**
 * Viem configuration for TacoClient
 */
export interface TacoClientViemConfig extends TacoClientBaseConfig {
  /** Viem PublicClient for blockchain operations */
  viemClient: PublicClient;
  /** Viem Account for signing operations */
  viemAccount: Account;
}

/**
 * Ethers configuration for TacoClient
 */
export interface TacoClientEthersConfig extends TacoClientBaseConfig {
  /** Ethers Provider for blockchain operations */
  ethersProvider: ethers.providers.Provider;
  /** Ethers Signer for signing operations */
  ethersSigner: ethers.Signer;
}

/**
 * Union type for TacoClient configuration - supports both viem and ethers.js
 */
export type TacoClientConfig = TacoClientViemConfig | TacoClientEthersConfig;

/**
 * Type guard to check if config is viem-based
 */
function isViemConfig(
  config: TacoClientConfig,
): config is TacoClientViemConfig {
  return 'viemClient' in config && 'viemAccount' in config;
}

/**
 * Type guard to check if config is ethers-based
 */
function isEthersConfig(
  config: TacoClientConfig,
): config is TacoClientEthersConfig {
  return 'ethersProvider' in config && 'ethersSigner' in config;
}

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
 * const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
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
 * const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
 * ```
 */
export class TacoClient {
  private config: TacoClientConfig;
  private logger: Logger;
  private domain: DomainName;

  /**
   * Create a new TacoClient instance
   *
   * @param config - TacoClient configuration
   * @throws {Error} If configuration is invalid
   */
  constructor(config: TacoClientConfig) {
    // Use provided logger or create a new one
    this.logger =
      config.logger ||
      new Logger({
        level: config.logLevel || LogLevel.INFO,
        component: 'TacoClient',
      });

    // Validate and process the configuration
    const processedConfig = TacoClient.validateConfig(config);
    if (!processedConfig.isValid) {
      throw new Error(
        `TacoClient Configuration Error: ${processedConfig.errors.join(', ')}`,
      );
    }

    this.config = config;
    this.domain = this.getDomainFromConfig(config.domain);

    this.logger.debug(`TacoClient initialized`, {
      domain: this.config.domain,
      ritualId: this.config.ritualId,
    });
  }

  /**
   * Validate TacoClient configuration
   *
   * @param config - Configuration to validate
   * @returns {ValidationResult} Validation result
   */
  static validateConfig(config: TacoClientConfig): ValidationResult {
    const errors: string[] = [];

    // Validate TACo domain configuration
    const tacoValidation = TacoConfig.validate({
      domain: config.domain,
      ritualId: config.ritualId,
    });

    if (!tacoValidation.isValid) {
      errors.push(...tacoValidation.errors);
    }

    // Validate required blockchain objects
    if (isViemConfig(config)) {
      // Validate viem objects
      if (!config.viemClient) {
        errors.push('viemClient is required for viem configuration');
      }
      if (!config.viemAccount) {
        errors.push('viemAccount is required for viem configuration');
      }
    } else if (isEthersConfig(config)) {
      // Validate ethers objects
      if (!config.ethersProvider) {
        errors.push('ethersProvider is required for ethers configuration');
      }
      if (!config.ethersSigner) {
        errors.push('ethersSigner is required for ethers configuration');
      }
    } else {
      errors.push(
        'Configuration must include either viem objects (viemClient + viemAccount) or ethers objects (ethersProvider + ethersSigner)',
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      config: errors.length === 0 ? config : undefined,
    };
  }

  /**
   * Get the domain object for porter operations
   *
   * @param domainName - TACo domain name (e.g., 'lynx', 'tapir', 'mainnet')
   * @returns {DomainName} Porter domain
   */
  private getDomainFromConfig(domainName: string): DomainName {
    // DomainName validity is ensured by prior validation in the constructor
    // The domain name is already the actual TACo domain string
    return domainName as DomainName;
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
    this.logger.debug('Starting encryption', {
      domain: this.config.domain,
      ritualId: this.config.ritualId,
      dataType: typeof data,
      dataLength: data.length,
    });

    try {
      let messageKit: ThresholdMessageKit;

      if (isViemConfig(this.config)) {
        // Use viem API
        messageKit = await encryptWithViem(
          this.config.viemClient,
          this.domain,
          data,
          accessCondition,
          this.config.ritualId,
          this.config.viemAccount,
        );
      } else if (isEthersConfig(this.config)) {
        // Use ethers API
        messageKit = await ethersEncrypt(
          this.config.ethersProvider,
          this.domain,
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

      this.logger.info('Encryption successful');
      return messageKit;
    } catch (error) {
      this.logger.error('Encryption failed', error);
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
    this.logger.debug('Starting decryption', {
      domain: this.config.domain,
      hasContext: !!conditionContext,
    });

    try {
      let decrypted: Uint8Array;

      if (isViemConfig(this.config)) {
        // Use viem API
        decrypted = await decryptWithViem(
          this.config.viemClient,
          this.domain,
          messageKit,
          conditionContext,
          this.config.porterUris,
        );
      } else if (isEthersConfig(this.config)) {
        // Use ethers API
        decrypted = await ethersDecrypt(
          this.config.ethersProvider,
          this.domain,
          messageKit,
          conditionContext,
          this.config.porterUris,
        );
      } else {
        throw new Error(
          'Invalid configuration: must provide either viem or ethers objects',
        );
      }

      this.logger.info('Decryption successful');
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new Error(`TaCo decryption failed: ${error}`);
    }
  }

  /**
   * Decrypt a message kit with automatic condition context creation
   *
   * This is a convenience method that automatically creates the condition context
   * for time-based conditions, making decryption simpler for common use cases.
   *
   * @param messageKit - Encrypted message kit
   * @returns {Promise<Uint8Array>} Decrypted data
   *
   * @example
   * ```typescript
   * const decrypted = await tacoClient.decryptWithAutoContext(messageKit);
   * ```
   */
  async decryptWithAutoContext(
    messageKit: ThresholdMessageKit,
  ): Promise<Uint8Array> {
    this.logger.debug('Starting decryption with auto context');

    try {
      // For auto context, we create a condition context with current time
      const conditionContext = await this.createConditionContext(messageKit);
      return await this.decrypt(messageKit, conditionContext);
    } catch (error) {
      this.logger.error('Auto-context decryption failed', error);
      throw new Error(`TaCo auto-context decryption failed: ${error}`);
    }
  }

  /**
   * Create a condition context for the given message kit
   *
   * @param messageKit - Message kit to create context for
   * @param customViemAccount - Optional custom viem account (defaults to instance account)
   * @returns {Promise<ConditionContext>} Condition context
   *
   * @example
   * ```typescript
   * const context = await tacoClient.createConditionContext(messageKit);
   * const decrypted = await tacoClient.decrypt(messageKit, context);
   * ```
   */
  async createConditionContext(
    messageKit: ThresholdMessageKit,
  ): Promise<ConditionContext> {
    this.logger.debug('Creating condition context');

    // Create condition context from the message kit's conditions
    const conditionContext = ConditionContext.fromMessageKit(messageKit);

    this.logger.debug('Condition context created successfully');
    return conditionContext;
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
