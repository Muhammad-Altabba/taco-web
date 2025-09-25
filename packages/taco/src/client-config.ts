/**
 * TacoClient configuration types and utilities
 *
 * This module contains all configuration interfaces, type definitions, and utility functions
 * for configuring TacoClient instances with different blockchain client libraries (viem, ethers.js).
 */

import { type PublicClient, type SignerAccount } from '@nucypher/shared';
import type { ethers } from 'ethers';

import type { DomainName } from './taco-config-validator';

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
}

/**
 * Viem configuration for TacoClient
 */
export interface TacoClientViemConfig extends TacoClientBaseConfig {
  /** Viem PublicClient for blockchain operations */
  viemClient: PublicClient;
  /** Viem SignerAccount for signing operations */
  viemSignerAccount: SignerAccount;
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
 * @param config - TacoClient configuration to check
 * @returns True if the configuration is for viem client
 */
export function isViemConfig(
  config: TacoClientConfig,
): config is TacoClientViemConfig {
  return 'viemClient' in config && 'viemSignerAccount' in config;
}

/**
 * Type guard to check if config is ethers-based
 * @param config - TacoClient configuration to check
 * @returns True if the configuration is for ethers client
 */
export function isEthersConfig(
  config: TacoClientConfig,
): config is TacoClientEthersConfig {
  return 'ethersProvider' in config && 'ethersSigner' in config;
}
