/**
 * TACo Domain Configuration
 *
 * Domain configuration for TACo operations
 */

/**
 * TACo domain configuration interface
 */
export interface TacoDomainConfig {
  /** Suggested provider RPC URLs for L2 operations */
  suggestedProviderRpcUrls: string[];
  /** Available ritual IDs */
  rituals: number[];
}

export type DomainName = 'lynx' | 'tapir' | 'mainnet';

/**
 * Complete TACo domain configuration
 *
 * needed for TACo operations including chain IDs, RPC URLs, and ritual management.
 *
 * ## Available Domains:
 *
 * ### `lynx` - DEVNET: Bleeding-edge developer network
 * - **Network Type**: DEVNET (Development/Experimental)
 * - **Production Status**: Non-Production (Testnet/Development)
 * - **L1**: Sepolia (11155111), **L2**: Polygon Amoy (80002)
 * - **Portal**: https://lynx-3.nucypher.network:9151/status
 * - **Status**: Testnet (Development) - May have breaking changes
 * - **Rituals**: [27] - Open ritual, no encryptor restrictions - **Cohort**: 2-of-3
 *
 * ### `tapir` - TESTNET: Stable testnet for current TACo release
 * - **Network Type**: TESTNET (Testing/Stable)
 * - **Production Status**: Non-Production (Testnet/Testing)
 * - **Recommended for**: TACo application testing and development
 * - **Chain ID**: 80002 (Polygon Amoy)
 * - **Portal**: https://tapir-2.nucypher.network:9151/status
 * - **Status**: Testnet (Stable) - Recommended for development and testing
 * - **Rituals**: [6] - Open ritual, no encryptor restrictions - **Cohort**: 4-of-6
 *
 * ### `mainnet` - MAINNET: Production network
 * - **Network Type**: MAINNET (Production)
 * - **Production Status**: Production (Live/Real Data)
 * - **Use Case**: Live TACo applications with real data and users
 * - **Chain ID**: 137 (Polygon)
 * - **Portal**: Contact TACo team for production monitoring Portal
 * - **Status**: Production - Requires custom ritual setup and payment
 * - **Rituals**: Custom rituals only - contact TACo team
 *
 * @example
 * ```typescript
 * // Access domain configuration
 * const lynxConfig = TACO_DOMAINS.lynx;
 * console.log(lynxConfig.suggestedProviderRpcUrls);
 * console.log(lynxConfig.rituals);
 *
 * // Use with TacoClient
 * const client = new TacoClient({
 *   domain: 'lynx',  // DEVNET environment
 *   ritualId: 27,    // Open ritual
 *   // ... other config
 * });
 * ```
 *
 * @see {@link getDomainMetadata} For programmatic access to domain metadata
 * @see {@link DOMAIN_METADATA} For structured domain information
 */
export const TACO_DOMAINS: Record<DomainName, TacoDomainConfig> = {
  // lynx - DEVNET: Bleeding-edge developer network
  lynx: {
    suggestedProviderRpcUrls: [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy.drpc.org',
    ],
    rituals: [
      27, // Open ritual, no encryptor restrictions
      // Contact TACo team if you would like to perform a new ritual and obtain a new custom ritual id on devnet.
    ],
  },
  // tapir - TESTNET: Stable testnet for current TACo release
  tapir: {
    suggestedProviderRpcUrls: [
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy.drpc.org',
    ],
    rituals: [
      6, // Open ritual, no encryptor restrictions
    ],
  },
  // mainnet - MAINNET: Production network
  mainnet: {
    suggestedProviderRpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc-mainnet.polygon.technology',
    ],
    rituals: [
      // No open rituals - all custom
      // Contact TACo team to set up a custom ritual for your production use on mainnet.
    ],
  },
};

/**
 * TACo Domain Name Constants
 *
 * Convenient constants for referencing TACo domain names in a type-safe manner.
 * Use these constants instead of hardcoded strings for better maintainability.
 *
 * @example
 * ```typescript
 * import { TacoDomains } from '@nucypher/taco';
 *
 * const client = new TacoClient({
 *   domain: TacoDomains.TESTNET, // 'tapir'
 *   ritualId: 6,
 *   // ...
 * });
 * ```
 */
export const TacoDomains = {
  /** DEVNET domain ('lynx') - Bleeding-edge developer network */
  DEVNET: 'lynx',
  /** TESTNET domain ('tapir') - Stable testnet for current TACo release */
  TESTNET: 'tapir',
  /** MAINNET domain ('mainnet') - Production network */
  MAINNET: 'mainnet',
} as const;

/**
 * TACo domain configuration input interface
 */
export interface TacoDomainConfigInput {
  domain?: DomainName;
  ritualId?: number;
  porterUris?: string[];
}

/**
 * Processed TACo domain configuration interface
 */
export interface ProcessedTacoDomainConfig {
  domain: DomainName;
  ritualId: number;
  rpcUrl?: string | null;
  porterUris?: string[] | undefined;
}

/**
 * Generic validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  config?: ProcessedTacoDomainConfig | undefined;
}

/**
 * TACo Configuration and Domain Management
 *
 * Unified class for TACo domain configuration, validation, and normalization.
 * Provides comprehensive domain management with auto-correction and validation.
 */
export class TacoConfig {
  /**
   * Get all supported TACo domain names
   * @returns {string[]} Array of supported TACo domain names ('lynx', 'tapir', 'mainnet')
   */
  static getSupportedDomains(): DomainName[] {
    return Object.keys(TACO_DOMAINS) as DomainName[];
  }

  /**
   * Check if domain is valid
   * @param domain - TACo domain name to check ('lynx', 'tapir', 'mainnet')
   * @returns {boolean} True if domain exists
   */
  static isValidDomain(domain: DomainName): boolean {
    return !!domain && TACO_DOMAINS[domain] !== undefined;
  }

  /**
   * Check if a TACo domain is a production domain
   * @param domain - TACo domain name to check
   * @returns {boolean} True if domain is production ('mainnet')
   */
  static isProductionDomain(domain: DomainName): boolean {
    return domain === 'mainnet';
  }

  // ========================================
  // Ritual Management
  // ========================================

  /**
   * Get default ritual ID for a domain
   * @param domain - Domain name
   * @returns {number|null} Default ritual ID or null if none available
   */
  static getDefaultRitualId(domain: DomainName): number | null {
    if (!this.isValidDomain(domain)) return null;
    const config = TACO_DOMAINS[domain];

    // Return first ritual ID, or null if no rituals available
    return config.rituals.length > 0 ? config.rituals[0] : null;
  }

  /**
   * Get available rituals for a domain
   * @param domain - Domain name
   * @returns {number[]} Array of available ritual IDs
   */
  static getAvailableRituals(domain: DomainName): number[] {
    if (!this.isValidDomain(domain)) return [];
    return TACO_DOMAINS[domain].rituals;
  }

  /**
   * Get default RPC URL for a domain
   * @param domain - Domain name
   * @returns {string|null} Default RPC URL or null if domain invalid
   */
  static getDefaultRpcUrl(domain: DomainName): string | null {
    if (!this.isValidDomain(domain)) return null;
    return TACO_DOMAINS[domain].suggestedProviderRpcUrls[0];
  }

  /**
   * Check if ritual ID is valid for a domain
   * @param domain - Domain name
   * @param ritualId - Ritual ID to validate
   * @returns {boolean} True if ritual ID is valid for the domain
   */
  static isValidRitualId(domain: DomainName, ritualId: number): boolean {
    if (!this.isValidDomain(domain)) return false;
    const config = TACO_DOMAINS[domain];

    // For mainnet, any positive number is valid (custom rituals)
    if (domain === 'mainnet') {
      return typeof ritualId === 'number' && ritualId > 0;
    }

    // For testnets, check if ritual ID is in the allowed list
    return config.rituals.includes(ritualId);
  }

  // ========================================
  // Configuration Management Methods
  // ========================================

  /**
   * Validate a TACo configuration (pure validation only)
   * @param config - Configuration to validate
   * @returns {ValidationResult} Validation result with isValid, errors, and config
   */
  static validate(config: TacoDomainConfigInput): ValidationResult {
    const errors: string[] = [];

    if (!config.domain) {
      errors.push('Domain is required');
    } else if (!this.isValidDomain(config.domain)) {
      errors.push(
        `Invalid domain: ${config.domain}. Supported: ${this.getSupportedDomains().join(', ')}`,
      );
    }

    // Validate ritual ID
    if (config.domain && this.isValidDomain(config.domain)) {
      if (this.isProductionDomain(config.domain)) {
        // Mainnet requires a custom ritual ID
        if (!config.ritualId) {
          errors.push(
            'Mainnet requires a custom ritual ID (contact TACo team for setup)',
          );
        } else if (!this.isValidRitualId(config.domain, config.ritualId)) {
          errors.push(
            'Invalid ritual ID for mainnet (must be positive number)',
          );
        }
      } else {
        // Testnets can have default ritual IDs
        if (
          config.ritualId &&
          !this.isValidRitualId(config.domain, config.ritualId)
        ) {
          const availableRituals = this.getAvailableRituals(config.domain);
          errors.push(
            `Invalid ritual ID for ${config.domain}. Available: ${availableRituals.join(', ')}`,
          );
        }
        // If no ritualId is provided, ensure a default exists
        if (!config.ritualId) {
          const def = this.getDefaultRitualId(config.domain);
          if (def == null) {
            errors.push(`No default ritual available for ${config.domain}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      config:
        errors.length === 0
          ? {
              domain: config.domain!,
              ritualId:
                config.ritualId ?? this.getDefaultRitualId(config.domain!)!,
            }
          : undefined,
    };
  }

  /**
   * Process and auto-correct user configuration
   * @param userConfig - User provided configuration
   * @returns {ProcessedTacoDomainConfig} Fully processed and normalized configuration
   * @throws {Error} If configuration is invalid after auto-correction
   */
  static process(userConfig: TacoDomainConfigInput): ProcessedTacoDomainConfig {
    // Step 1: Auto-correct common mistakes
    const config = { ...userConfig };

    // Auto-correct domain name and handle legacy domain names
    if (typeof config.domain === 'string') {
      const lowerDomain = config.domain.toLowerCase();

      // Check if it's already a valid TACo domain name
      if (this.getSupportedDomains().includes(lowerDomain as DomainName)) {
        config.domain = lowerDomain as DomainName;
      } else {
        // Handle if the uses passed the domain type (taco network type) instead of the domain name - (DEVNET -> lynx, TESTNET -> tapir, MAINNET -> mainnet)
        const legacyMapping: Record<string, DomainName> = {
          devnet: 'lynx',
          testnet: 'tapir',
          mainnet: 'mainnet',
        };

        if (lowerDomain in legacyMapping) {
          config.domain = legacyMapping[lowerDomain] as DomainName;
        }
      }
    }

    // Auto-set default ritual ID for testnets if missing
    if (config.domain && this.isValidDomain(config.domain)) {
      if (!config.ritualId) {
        const defaultRitualId = this.getDefaultRitualId(config.domain);
        if (defaultRitualId !== null) {
          config.ritualId = defaultRitualId;
        }
      }
    }

    // Step 2: Validate the corrected configuration
    const validation = this.validate(config);
    if (!validation.isValid) {
      throw new Error(
        `TACo Configuration Error: ${validation.errors.join(', ')}`,
      );
    }

    // At this point we know domain and ritualId are defined due to validation
    const domain = config.domain!;
    const ritualId = config.ritualId!;

    // Step 3: Normalize with additional configuration
    const normalizedConfig: ProcessedTacoDomainConfig = {
      domain,
      ritualId,
      rpcUrl: this.getDefaultRpcUrl(domain),
      porterUris: config.porterUris,
    };

    return normalizedConfig;
  }
}
