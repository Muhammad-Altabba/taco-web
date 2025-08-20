/**
 * TacoClient Tests
 *
 * Tests for the Object-Oriented TacoClient interface
 */

import { type Account, type PublicClient } from '@nucypher/shared';
import type { ethers } from 'ethers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type DomainName,
  TACO_DOMAINS,
  TacoClient,
  TacoClientConfig,
  TacoClientEthersConfig,
  TacoClientViemConfig,
  TacoConfig,
} from '../src';

// Mock viem dependencies
const mockViemClient = {
  getChainId: vi.fn().mockResolvedValue(80002),
  call: vi.fn().mockResolvedValue('0x'),
  getNetwork: vi
    .fn()
    .mockResolvedValue({ chainId: 80002, name: 'polygon-amoy' }),
  readContract: vi.fn().mockResolvedValue('0x'),
} as unknown as PublicClient;

const mockViemAccount = {
  address: '0x742d35Cc6632C0532c718F63b1a8D7d8a7fAd3b2',
  signMessage: vi.fn().mockResolvedValue('0x'),
  signTypedData: vi.fn().mockResolvedValue('0x'),
} as unknown as Account;

// Mock ethers dependencies
const mockEthersProvider = {
  getNetwork: vi
    .fn()
    .mockResolvedValue({ name: 'polygon-amoy', chainId: 80002 }),
  getBalance: vi.fn().mockResolvedValue('1000000000000000000'),
  getCode: vi.fn().mockResolvedValue('0x'),
} as unknown as ethers.providers.Provider;

const mockEthersSigner = {
  getAddress: vi
    .fn()
    .mockResolvedValue('0x742d35Cc6632C0532c718F63b1a8D7d8a7fAd3b2'),
  signMessage: vi.fn().mockResolvedValue('0x'),
  provider: mockEthersProvider,
} as unknown as ethers.Signer;

describe('TacoConfig', () => {
  describe('Domain Management', () => {
    it('should return all supported domains', () => {
      const domains = TacoConfig.getSupportedDomains();
      expect(domains).toEqual(['lynx', 'tapir', 'mainnet']);
    });

    it('should validate domain names correctly', () => {
      expect(TacoConfig.isValidDomain('tapir')).toBe(true);
      expect(TacoConfig.isValidDomain('lynx')).toBe(true);
      expect(TacoConfig.isValidDomain('mainnet')).toBe(true);
      expect(TacoConfig.isValidDomain('INVALID' as DomainName)).toBe(false);
      expect(TacoConfig.isValidDomain('' as DomainName)).toBe(false);
    });

    it('should identify production domains', () => {
      expect(TacoConfig.isProductionDomain('mainnet')).toBe(true);
      expect(TacoConfig.isProductionDomain('tapir')).toBe(false);
      expect(TacoConfig.isProductionDomain('lynx')).toBe(false);
    });

    it('should return correct default ritual IDs', () => {
      expect(TacoConfig.getDefaultRitualId('lynx')).toBe(27);
      expect(TacoConfig.getDefaultRitualId('tapir')).toBe(6);
      expect(TacoConfig.getDefaultRitualId('mainnet')).toBe(null);
      expect(TacoConfig.getDefaultRitualId('INVALID' as DomainName)).toBe(null);
    });

    it('should return available rituals for domains', () => {
      expect(TacoConfig.getAvailableRituals('lynx')).toEqual([27]);
      expect(TacoConfig.getAvailableRituals('tapir')).toEqual([6]);
      expect(TacoConfig.getAvailableRituals('mainnet')).toEqual([]);
      expect(TacoConfig.getAvailableRituals('INVALID' as DomainName)).toEqual(
        [],
      );
    });

    it('should validate ritual IDs correctly', () => {
      // Valid ritual IDs for testnets
      expect(TacoConfig.isValidRitualId('lynx', 27)).toBe(true);
      expect(TacoConfig.isValidRitualId('tapir', 6)).toBe(true);

      // Invalid ritual IDs for testnets
      expect(TacoConfig.isValidRitualId('lynx', 999)).toBe(false);
      expect(TacoConfig.isValidRitualId('tapir', 999)).toBe(false);

      // Mainnet accepts any positive number
      expect(TacoConfig.isValidRitualId('mainnet', 42)).toBe(true);
      expect(TacoConfig.isValidRitualId('mainnet', 1)).toBe(true);
      expect(TacoConfig.isValidRitualId('mainnet', 0)).toBe(false);
    });
  });

  describe('Configuration Processing', () => {
    it('should process valid testnet configuration', () => {
      const config = TacoConfig.process({
        domain: 'tapir',
        ritualId: 6,
      });

      expect(config.domain).toBe('tapir');
      expect(config.ritualId).toBe(6);
      expect(config.rpcUrl).toBeDefined();
    });

    it('should use domain names as-is when valid', () => {
      const config = TacoConfig.process({
        domain: 'tapir',
      });

      expect(config.domain).toBe('tapir');
      expect(config.ritualId).toBe(6); // Auto-set default
    });

    it('should support legacy domain name mapping', () => {
      const devnetConfig = TacoConfig.process({
        domain: 'devnet' as DomainName,
      });
      expect(devnetConfig.domain).toBe('lynx');

      const testnetConfig = TacoConfig.process({
        domain: 'testnet' as DomainName,
      });
      expect(testnetConfig.domain).toBe('tapir');

      const mainnetConfig = TacoConfig.process({
        domain: 'mainnet',
        ritualId: 42,
      });
      expect(mainnetConfig.domain).toBe('mainnet');
    });

    it('should auto-set default ritual IDs for testnets', () => {
      const devnetConfig = TacoConfig.process({
        domain: 'lynx',
      });
      expect(devnetConfig.ritualId).toBe(27);

      const testnetConfig = TacoConfig.process({
        domain: 'tapir',
      });
      expect(testnetConfig.ritualId).toBe(6);
    });

    it('should throw for invalid configurations', () => {
      expect(() =>
        TacoConfig.process({
          domain: 'INVALID_DOMAIN' as DomainName,
        }),
      ).toThrow('TACo Configuration Error');

      expect(() =>
        TacoConfig.process({
          domain: 'tapir',
          ritualId: 999,
        }),
      ).toThrow('Invalid ritual ID');

      expect(() =>
        TacoConfig.process({
          domain: 'mainnet',
          // Missing required ritualId for mainnet
        }),
      ).toThrow('Mainnet requires a custom ritual ID');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configurations', () => {
      const result = TacoConfig.validate({
        domain: 'tapir',
        ritualId: 6,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toBeDefined();
    });

    it('should detect invalid configurations', () => {
      const result = TacoConfig.validate({
        domain: 'INVALID_DOMAIN' as DomainName,
        ritualId: 999,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.config).toBe(undefined);
    });

    it('should require domain', () => {
      const result = TacoConfig.validate({
        ritualId: 6,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Domain is required');
    });
  });
});

describe('TacoClient', () => {
  let validViemConfig: TacoClientViemConfig;
  let validEthersConfig: TacoClientEthersConfig;

  beforeEach(() => {
    validViemConfig = {
      domain: 'tapir',
      ritualId: 6,
      viemClient: mockViemClient,
      viemAccount: mockViemAccount,
    };

    validEthersConfig = {
      domain: 'tapir',
      ritualId: 6,
      ethersProvider: mockEthersProvider,
      ethersSigner: mockEthersSigner,
    };
  });

  describe('Construction', () => {
    it('should create client with valid viem configuration', () => {
      const client = new TacoClient(validViemConfig);
      expect(client).toBeInstanceOf(TacoClient);
    });

    it('should create client with valid ethers configuration', () => {
      const client = new TacoClient(validEthersConfig);
      expect(client).toBeInstanceOf(TacoClient);
    });

    it('should throw with invalid domain', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            domain: 'INVALID_DOMAIN' as DomainName,
          }),
      ).toThrow('TacoClient Configuration Error');
    });

    it('should throw when missing viem objects', () => {
      expect(
        () =>
          new TacoClient({
            domain: 'tapir',
            ritualId: 6,
          } as unknown as TacoClientConfig),
      ).toThrow('Configuration must include either viem objects');
    });

    it('should throw when missing viemClient in viem config', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            viemClient: undefined,
          } as unknown as TacoClientConfig),
      ).toThrow('viemClient is required for viem configuration');
    });

    it('should throw when missing viemAccount in viem config', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            viemAccount: undefined,
          } as unknown as TacoClientConfig),
      ).toThrow('viemAccount is required for viem configuration');
    });

    it('should throw when missing ethersProvider in ethers config', () => {
      expect(
        () =>
          new TacoClient({
            ...validEthersConfig,
            ethersProvider: undefined,
          } as unknown as TacoClientConfig),
      ).toThrow('ethersProvider is required for ethers configuration');
    });

    it('should throw when missing ethersSigner in ethers config', () => {
      expect(
        () =>
          new TacoClient({
            ...validEthersConfig,
            ethersSigner: undefined,
          } as unknown as TacoClientConfig),
      ).toThrow('ethersSigner is required for ethers configuration');
    });
  });

  describe('Configuration Methods', () => {
    it('should return readonly configuration', () => {
      const client = new TacoClient(validViemConfig);
      const config = client.getConfig();

      expect(config.domain).toBe('tapir');
      expect(config.ritualId).toBe(6);
    });

    it('should return readonly configuration', () => {
      const client = new TacoClient(validViemConfig);
      const config = client.getConfig();

      expect(config.domain).toBe('tapir');
      expect(config.ritualId).toBe(6);

      // Should be frozen/readonly
      expect(() => {
        (config as Record<string, unknown>).domain = 'lynx';
      }).toThrow();
    });
  });

  describe('Static Validation', () => {
    it('should validate correct viem configuration', () => {
      const result = TacoClient.validateConfig(validViemConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate correct ethers configuration', () => {
      const result = TacoClient.validateConfig(validEthersConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing dependencies', () => {
      const result = TacoClient.validateConfig({
        domain: 'tapir',
        ritualId: 6,
        // Missing blockchain objects
      } as unknown as TacoClientConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Configuration must include either viem objects (viemClient + viemAccount) or ethers objects (ethersProvider + ethersSigner)',
      );
    });
  });
});

describe('TACO_DOMAINS', () => {
  it('should have correct structure', () => {
    expect(TACO_DOMAINS).toBeDefined();
    expect(TACO_DOMAINS.lynx).toBeDefined();
    expect(TACO_DOMAINS.tapir).toBeDefined();
    expect(TACO_DOMAINS.mainnet).toBeDefined();
  });

  it('should have required properties for each domain', () => {
    Object.values(TACO_DOMAINS).forEach((domain) => {
      expect(domain.suggestedProviderRpcUrls).toBeInstanceOf(Array);
      expect(domain.rituals).toBeInstanceOf(Array);
      // isProduction property removed - production status moved to comments
    });
  });

  it('should have network types documented in comments', () => {
    // Network type and production status information moved to comments in domain configuration
    // lynx = DEVNET (Non-Production), tapir = TESTNET (Non-Production), mainnet = MAINNET (Production)
    // This information is now documented in comments rather than runtime properties
    expect(Object.keys(TACO_DOMAINS)).toEqual(['lynx', 'tapir', 'mainnet']);
  });

  it('should derive production status from domain names', () => {
    // Production status is now derived from domain names rather than stored as properties
    expect(TacoConfig.isProductionDomain('lynx')).toBe(false);
    expect(TacoConfig.isProductionDomain('tapir')).toBe(false);
    expect(TacoConfig.isProductionDomain('mainnet')).toBe(true);
  });
});
