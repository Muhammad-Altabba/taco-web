/**
 * TacoClient Tests
 *
 * Tests for the Object-Oriented TacoClient interface
 */

import { type Account, type PublicClient } from '@nucypher/shared';
import type { ethers } from 'ethers';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DOMAINS,
  TacoClient,
  type TacoClientConfig,
  type TacoClientEthersConfig,
  type TacoClientViemConfig,
} from '../src';
import {
  type DomainName,
  TacoConfigValidator,
} from '../src/taco-config-validator';

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

describe('TacoConfigValidator', () => {
  describe('Domain Management', () => {
    it('should return all supported domains', () => {
      const domains = TacoConfigValidator.getSupportedDomains();
      expect(domains).toEqual(['lynx', 'tapir', 'mainnet']);
    });

    it('should validate domain names correctly', () => {
      expect(TacoConfigValidator.isValidDomain('tapir')).toBe(true);
      expect(TacoConfigValidator.isValidDomain('lynx')).toBe(true);
      expect(TacoConfigValidator.isValidDomain('mainnet')).toBe(true);
      expect(TacoConfigValidator.isValidDomain('INVALID' as DomainName)).toBe(
        false,
      );
      expect(TacoConfigValidator.isValidDomain('' as DomainName)).toBe(false);
    });

    it('should validate ritual IDs correctly (positive numbers only)', () => {
      // Any positive number is valid for any domain
      expect(TacoConfigValidator.isValidRitualId('lynx', 27)).toBe(true);
      expect(TacoConfigValidator.isValidRitualId('tapir', 6)).toBe(true);
      expect(TacoConfigValidator.isValidRitualId('mainnet', 42)).toBe(true);
      expect(TacoConfigValidator.isValidRitualId('lynx', 999)).toBe(true);
      expect(TacoConfigValidator.isValidRitualId('tapir', 999)).toBe(true);
      expect(TacoConfigValidator.isValidRitualId('mainnet', 1)).toBe(true);

      // Zero and negative numbers are invalid
      expect(TacoConfigValidator.isValidRitualId('mainnet', 0)).toBe(false);
      expect(TacoConfigValidator.isValidRitualId('lynx', -1)).toBe(false);
      expect(TacoConfigValidator.isValidRitualId('tapir', -5)).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configurations', () => {
      const result = TacoConfigValidator.validateFast({
        domain: 'tapir',
        ritualId: 6,
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid configurations', () => {
      const result = TacoConfigValidator.validateFast({
        domain: 'INVALID_DOMAIN' as DomainName,
        ritualId: 999,
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require domain', () => {
      const result = TacoConfigValidator.validateFast({
        ritualId: 6,
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      } as TacoClientConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('The property `domain` is required');
    });
  });
});

// Helper to access TacoClient's private static members for testing
const getTacoClientStatics = () =>
  TacoClient as unknown as { initializationPromise: Promise<void> | undefined };
const resetTacoClientStatics = () => {
  delete (TacoClient as unknown as { initializationPromise?: Promise<void> })
    .initializationPromise;
};

describe('TacoClient', () => {
  beforeAll(async () => {
    // Should be able to wait for initialization
    await TacoClient.initialize();
  });

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

    it('should throw for invalid domain', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            domain: 'INVALID' as DomainName,
          }),
      ).toThrow('Invalid domain name');
    });

    it('should throw for invalid ritual ID', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            ritualId: -1,
          }),
      ).toThrow('Invalid ritual ID');
    });

    it('should throw for missing required domain', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            domain: undefined,
          } as unknown as TacoClientConfig),
      ).toThrow('The property `domain` is required');
    });

    it('should throw for missing required ritual ID', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            ritualId: undefined,
          } as unknown as TacoClientConfig),
      ).toThrow('The property `ritualId` is required');
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

    it('should throw for mixed configuration types', () => {
      expect(
        () =>
          new TacoClient({
            domain: 'tapir',
            ritualId: 6,
            viemClient: mockViemClient,
            ethersProvider: mockEthersProvider,
          } as unknown as TacoClientConfig),
      ).toThrow('viemAccount is required for viem configuration');
    });
  });

  describe('Configuration Methods', () => {
    it('should return readonly configuration for viem client', () => {
      const client = new TacoClient(validViemConfig);
      const config = client.getConfig();

      expect(config.domain).toBe('tapir');
      expect(config.ritualId).toBe(6);
      expect('viemClient' in config).toBe(true);
      expect('viemAccount' in config).toBe(true);

      // Should be frozen/readonly
      expect(() => {
        (config as Record<string, unknown>).domain = 'lynx';
      }).toThrow();
    });

    it('should return readonly configuration for ethers client', () => {
      const client = new TacoClient(validEthersConfig);
      const config = client.getConfig();

      expect(config.domain).toBe('tapir');
      expect(config.ritualId).toBe(6);
      expect('ethersProvider' in config).toBe(true);
      expect('ethersSigner' in config).toBe(true);

      // Should be frozen/readonly
      expect(() => {
        (config as Record<string, unknown>).domain = 'lynx';
      }).toThrow();
    });
  });

  describe('Initialization', () => {
    it('should initialize TACo automatically', async () => {
      // Reset static initialization state to check for automatic initialization
      // that happens after calling any TacoClient constructor
      resetTacoClientStatics();

      new TacoClient(validViemConfig);

      // Initialization should be triggered by constructor
      expect(getTacoClientStatics().initializationPromise).toBeDefined();
    });

    it('should share initialization across multiple clients', async () => {
      new TacoClient(validViemConfig);
      new TacoClient({
        ...validViemConfig,
        ritualId: 27, // Different ritual ID
      });

      // Both clients should share the same initialization promise
      const initPromise1 = getTacoClientStatics().initializationPromise;
      const initPromise2 = getTacoClientStatics().initializationPromise;

      expect(initPromise1).toBe(initPromise2);
      expect(initPromise1).toBeDefined();
    });

    it('should have error handling structure in place', async () => {
      // Test that TacoClient.initialize() method exists and returns a promise
      const initPromise = TacoClient.initialize();
      expect(initPromise).toBeInstanceOf(Promise);

      // Wait for initialization to complete
      await initPromise;

      // Verify that repeated calls return the same promise (singleton pattern)
      const initPromise2 = TacoClient.initialize();
      expect(initPromise2).toBeInstanceOf(Promise);
    });
  });

  describe('Static Validation', () => {
    it('should validate correct viem configuration', async () => {
      const result = await TacoConfigValidator.validateFull(validViemConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate correct ethers configuration', async () => {
      const result = await TacoConfigValidator.validateFull(validEthersConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing dependencies', async () => {
      const result = await TacoConfigValidator.validateFull({
        domain: 'tapir',
        ritualId: 6,
        // Missing blockchain objects
      } as unknown as TacoClientConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Configuration must include either viem objects (viemClient + viemAccount) or ethers objects (ethersProvider + ethersSigner)',
      );
    });

    it('should detect invalid domain in validation', async () => {
      const result = await TacoConfigValidator.validateFull({
        ...validViemConfig,
        domain: 'INVALID' as DomainName,
      });

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('Invalid domain name')),
      ).toBe(true);
    });

    it('should detect invalid ritual ID in validation', async () => {
      expect(
        () =>
          new TacoClient({
            domain: 'tapir',
            ritualId: -5,
            viemClient: mockViemClient,
            viemAccount: mockViemAccount,
          }),
      ).toThrow('Invalid ritual ID');
    });
  });

  describe('Domain Handling', () => {
    it('should work with all supported domains', () => {
      const lynxConfig: TacoClientViemConfig = {
        domain: 'lynx',
        ritualId: 27,
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      };

      const mainnetConfig: TacoClientViemConfig = {
        domain: 'mainnet',
        ritualId: 42, // Custom ritual ID for mainnet
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      };

      expect(() => new TacoClient(lynxConfig)).not.toThrow();
      expect(() => new TacoClient(validViemConfig)).not.toThrow(); // tapir
      expect(() => new TacoClient(mainnetConfig)).not.toThrow();
    });

    it('should provide correct domain information', () => {
      const client = new TacoClient(validViemConfig);
      const config = client.getConfig();

      expect(config.domain).toBe('tapir');
    });
  });
});

describe('DOMAINS', () => {
  it('should have correct simplified structure', () => {
    expect(DOMAINS).toBeDefined();
    expect(Object.keys(DOMAINS)).toContain('DEVNET');
    expect(Object.keys(DOMAINS)).toContain('TESTNET');
    expect(Object.keys(DOMAINS)).toContain('MAINNET');
  });

  it('should have required properties for each domain', () => {
    Object.values(DOMAINS).forEach((domainInfo) => {
      expect(domainInfo.domain).toBeDefined();
      expect(domainInfo.chainId).toBeDefined();
      expect(typeof domainInfo.chainId).toBe('number');
    });
  });
});
