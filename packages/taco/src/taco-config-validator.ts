/**
 * TACo Domain Configuration and Validation
 *
 * This module provides domain configuration management, validation utilities,
 * and configuration processing for TACo operations across different networks.
 */

import { ethers } from 'ethers';
import type { PublicClient } from 'viem';

import type { TacoClientConfig } from './client-config';

export type DomainName = 'lynx' | 'tapir' | 'mainnet';

/**
 * TACo domain configuration with essential network data
 *
 * Contains domain names, chain IDs, and core infrastructure information
 * needed for TACo operations across different networks.
 *
 * ## Available Domains:
 *
 * ### `lynx` - DEVNET: Bleeding-edge developer network
 * - **Network Type**: DEVNET (Development/Experimental)
 * - **Chain ID**: 80002 (Polygon Amoy)
 * - **Status**: Testnet (Development) - May have breaking changes
 * - **Rituals**: Open ritual available - **Cohort**: 2-of-3
 *
 * ### `tapir` - TESTNET: Stable testnet for current TACo release
 * - **Network Type**: TESTNET (Testing/Stable)
 * - **Chain ID**: 80002 (Polygon Amoy)
 * - **Status**: Testnet (Stable) - Recommended for testing
 * - **Rituals**: Stable ritual configuration - **Cohort**: 3-of-5
 *
 * ### `mainnet` - MAINNET: Production network for live applications
 * - **Network Type**: MAINNET (Production)
 * - **Chain ID**: 137 (Polygon)
 * - **Status**: Production (Live) - For real applications
 * - **Rituals**: Production ritual configuration - **Cohort**: 5-of-8
 *
 * @example
 * ```typescript
 * // Get domain information
 * const lynxInfo = DOMAINS.DEVNET;
 * console.log(lynxInfo.domain); // 'lynx'
 * console.log(lynxInfo.chainId); // 80002
 * ```
 */
export const DOMAINS = {
  // lynx - DEVNET: Bleeding-edge developer network
  DEVNET: {
    domain: 'lynx',
    chainId: 80002,
  },
  // tapir - TESTNET: Stable testnet for current TACo release
  TESTNET: {
    domain: 'tapir',
    chainId: 80002,
  },
  // mainnet - MAINNET: Production network
  MAINNET: {
    domain: 'mainnet',
    chainId: 137,
  },
} as const;

/**
 * TACo Domain Name Constants
 *
 * Convenient constants for referencing TACo domain names in a type-safe manner.
 * Use these constants instead of hardcoded strings for better maintainability.
 */
export const DOMAIN_NAMES = {
  /** DEVNET domain ('lynx') - Bleeding-edge developer network */
  DEVNET: 'lynx',
  /** TESTNET domain ('tapir') - Stable testnet for current TACo release */
  TESTNET: 'tapir',
  /** MAINNET domain ('mainnet') - Production network */
  MAINNET: 'mainnet',
} as const;

/**
 * Domain-ChainId validation type - creates a discriminated union
 * where each domain is linked to its specific chainId
 */
export type DomainChainConfig = {
  [K in keyof typeof DOMAINS]: {
    domain: (typeof DOMAINS)[K]['domain'];
    chainId: (typeof DOMAINS)[K]['chainId'];
  };
}[keyof typeof DOMAINS];

/**
 * Validates that the provided domain and chainId combination is correct
 * TypeScript will enforce that only valid domain/chainId pairs are accepted
 */
export function validateDomainChain(config: DomainChainConfig): boolean {
  const domainInfo = Object.values(DOMAINS).find(
    (info) => info.domain === config.domain,
  );
  return !!domainInfo && domainInfo.chainId === config.chainId;
}

/**
 * Generic validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * TACo Configuration Validator
 *
 * Validates TACo client configurations, domains, and provider compatibility.
 * Provides both fast and full validation methods for TACo operations.
 */
export class TacoConfigValidator {
  /**
   * Get all supported TACo domain names
   * @returns {DomainName[]} Array of supported TACo domain names ('lynx', 'tapir', 'mainnet')
   */
  static getSupportedDomains(): DomainName[] {
    return Object.values(DOMAINS).map((domain) => domain.domain);
  }

  /**
   * Check if domain is valid
   * @param domain - TACo domain name to check ('lynx', 'tapir', 'mainnet')
   * @returns {boolean} True if domain exists
   */
  static isValidDomain(domain: DomainName): boolean {
    return !!domain && this.getSupportedDomains().includes(domain);
  }

  /**
   * Validate ritual ID (basic validation - positive number only)
   * @param domain - Domain name (unused but kept for API compatibility)
   * @param ritualId - Ritual ID to validate
   * @returns {boolean} True if valid (positive number)
   */
  static isValidRitualId(domain: DomainName, ritualId: number): boolean {
    return typeof ritualId === 'number' && ritualId > 0;
  }

  /**
   * Validate provider compatibility with domain
   * @param domain - Domain name
   * @param provider - Provider to validate (viem PublicClient or ethers Provider)
   * @returns {Promise<boolean>} True if provider is valid for domain
   */
  static async isValidProvider(
    domain: DomainName,
    provider: PublicClient | ethers.providers.Provider,
  ): Promise<boolean> {
    let chainId: number;

    try {
      // Try to detect provider type and get chain ID safely
      if (provider && typeof provider === 'object') {
        // Check if it's a viem PublicClient (has getChainId method)
        if (
          'getChainId' in provider &&
          typeof provider.getChainId === 'function'
        ) {
          chainId = await (provider as PublicClient).getChainId();
        }
        // Check if it's an ethers Provider (has getNetwork method)
        else if (
          'getNetwork' in provider &&
          typeof provider.getNetwork === 'function'
        ) {
          const network = await (
            provider as ethers.providers.Provider
          ).getNetwork();
          chainId = network.chainId;
        } else {
          // Unknown provider type
          return false;
        }
      } else {
        // Invalid provider
        return false;
      }
    } catch (error) {
      // Error getting chain ID
      return false;
    }

    // Check if the provider's chain ID matches the domain's expected chain ID
    return (
      Object.values(DOMAINS).find(
        (domainInfo) =>
          domainInfo.domain === domain && domainInfo.chainId === chainId,
      ) !== undefined
    );
  }

  /**
   * Fast validation (everything except provider network checks)
   * @param config - Configuration to validate
   * @returns {ValidationResult} Validation result
   */
  static validateFast(config: TacoClientConfig): ValidationResult {
    const errors: string[] = [];

    // Validate domain
    if (!config.domain) {
      errors.push('The property `domain` is required');
    } else if (!this.isValidDomain(config.domain)) {
      errors.push(
        `Invalid domain name: ${config.domain}. Supported domains: ${this.getSupportedDomains().join(', ')}`,
      );
    }

    // Validate ritual ID
    if (!config.ritualId) {
      errors.push('The property `ritualId` is required');
    } else if (!this.isValidRitualId(config.domain, config.ritualId)) {
      errors.push(
        `Invalid ritual ID: ${config.ritualId} for domain ${config.domain}`,
      );
    }

    // Validate blockchain client configuration
    if ('viemClient' in config) {
      // Viem configuration
      if (!config.viemClient) {
        errors.push('viemClient is required for viem configuration');
      }
      if (!config.viemAccount) {
        errors.push('viemAccount is required for viem configuration');
      }
    } else if ('ethersProvider' in config) {
      // Ethers configuration
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

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Full validation including provider network checks
   * @param config - Configuration to validate
   * @returns {Promise<ValidationResult>} Validation result with provider validation
   */
  static async validateFull(
    config: TacoClientConfig,
  ): Promise<ValidationResult> {
    // First run fast validation
    const fastResult = this.validateFast(config);
    if (!fastResult.isValid) {
      return fastResult;
    }

    const errors: string[] = [];

    // Additional async provider validation
    let provider: PublicClient | ethers.providers.Provider | undefined;

    if ('viemClient' in config) {
      provider = config.viemClient;
    } else if ('ethersProvider' in config) {
      provider = config.ethersProvider;
    }

    // Validate provider compatibility with domain (if both exist)
    if (provider && config.domain) {
      const isValidProvider = await this.isValidProvider(
        config.domain,
        provider,
      );
      if (!isValidProvider) {
        errors.push(
          `Invalid provider for domain: ${config.domain}. Provider chain ID does not match domain requirements.`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
