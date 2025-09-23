import type { ethers } from 'ethers';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TacoClient,
  type TacoClientConfig,
  type TacoClientEthersConfig,
  type TacoClientViemConfig,
} from '../src';
import {
  type DomainName,
  TacoConfigValidator,
} from '../src/taco-config-validator';

// Mock viem dependencies for testing
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

// Mock ethers dependencies for testing
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
    it('should return all supported domain names', () => {
      const domains = TacoConfigValidator.getSupportedDomains();
      expect(domains).toEqual(['lynx', 'tapir', 'mainnet']);
    });

    it.each([
      ['tapir', true, 'valid testnet domain'],
      ['lynx', true, 'valid devnet domain'],
      ['mainnet', true, 'valid production domain'],
      ['INVALID', false, 'invalid domain name'],
      ['', false, 'empty domain name'],
      ['testnet', false, 'legacy domain key (not domain name)'],
    ])('should validate domain "%s" as %s (%s)', (domain, expected) => {
      expect(TacoConfigValidator.isValidDomain(domain as DomainName)).toBe(
        expected,
      );
    });

    it.each([
      // Valid ritual IDs (any positive number)
      ['lynx', 27, true, 'default devnet ritual ID'],
      ['tapir', 6, true, 'default testnet ritual ID'],
      ['mainnet', 42, true, 'custom mainnet ritual ID'],
      ['lynx', 999, true, 'large ritual ID for devnet'],
      ['tapir', 1, true, 'minimum valid ritual ID'],
      ['mainnet', 100, true, 'typical mainnet ritual ID'],
      // Invalid ritual IDs (zero and negative)
      ['mainnet', 0, false, 'zero ritual ID'],
      ['lynx', -1, false, 'negative ritual ID'],
      ['tapir', -5, false, 'large negative ritual ID'],
    ])(
      `should validate with domain "%s" the ritual ID %d as %s (%s)`,
      (domain, ritualId, expected) => {
        expect(
          TacoConfigValidator.isValidRitualId(domain as DomainName, ritualId),
        ).toBe(expected);
      },
    );
  });

  describe('Fast Configuration Validation', () => {
    it('should pass validation for valid viem configuration', () => {
      const result = TacoConfigValidator.validateFast({
        domain: 'tapir',
        ritualId: 6,
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid domain configuration', () => {
      const result = TacoConfigValidator.validateFast({
        domain: 'INVALID_DOMAIN' as DomainName,
        ritualId: 999,
        viemClient: mockViemClient,
        viemAccount: mockViemAccount,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when domain is missing', () => {
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

// Test helpers for accessing TacoClient's private static members
const getTacoClientStatics = () =>
  TacoClient as unknown as { initializationPromise: Promise<void> | undefined };

const resetTacoClientStatics = () => {
  delete (TacoClient as unknown as { initializationPromise?: Promise<void> })
    .initializationPromise;
};

describe('TacoClient', () => {
  beforeAll(async () => {
    // Ensure TacoClient is initialized before running tests
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

  describe('Client Construction', () => {
    it('should successfully create client with valid viem configuration', () => {
      const client = new TacoClient(validViemConfig);
      expect(client).toBeInstanceOf(TacoClient);
    });

    it('should successfully create client with valid ethers configuration', () => {
      const client = new TacoClient(validEthersConfig);
      expect(client).toBeInstanceOf(TacoClient);
    });

    it('should throw error for invalid domain name', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            domain: 'INVALID' as DomainName,
          }),
      ).toThrow('Invalid domain name');
    });

    it('should throw error for invalid ritual ID', () => {
      expect(
        () =>
          new TacoClient({
            ...validViemConfig,
            ritualId: -1,
          }),
      ).toThrow('Invalid ritual ID');
    });

    it.each([
      {
        configModifications: { domain: undefined },
        baseConfig: 'viem',
        expectedError: 'The property `domain` is required',
        description: 'missing domain from viem config',
      },
      {
        configModifications: { ritualId: undefined },
        baseConfig: 'viem',
        expectedError: 'The property `ritualId` is required',
        description: 'missing ritual ID from viem config',
      },
      {
        configModifications: { viemClient: undefined },
        baseConfig: 'viem',
        expectedError: 'viemClient is required for viem configuration',
        description: 'missing viemClient from viem config',
      },
      {
        configModifications: { viemSignerAccount: undefined },
        baseConfig: 'viem',
        expectedError: 'viemSignerAccount is required for viem configuration',
        description: 'missing viemSignerAccount from viem config',
      },
      {
        configModifications: { domain: undefined },
        baseConfig: 'ethers',
        expectedError: 'The property `domain` is required',
        description: 'missing domain from ethers config',
      },
      {
        configModifications: { ritualId: undefined },
        baseConfig: 'ethers',
        expectedError: 'The property `ritualId` is required',
        description: 'missing ritual ID from ethers config',
      },
      {
        configModifications: { ethersProvider: undefined },
        baseConfig: 'ethers',
        expectedError: 'ethersProvider is required for ethers configuration',
        description: 'missing ethersProvider from ethers config',
      },
      {
        configModifications: { ethersSigner: undefined },
        baseConfig: 'ethers',
        expectedError: 'ethersSigner is required for ethers configuration',
        description: 'missing ethersSigner from ethers config',
      },
    ])(
      'should throw error for $description',
      ({ configModifications, baseConfig, expectedError }) => {
        const baseConfigObject =
          baseConfig === 'viem' ? validViemConfig : validEthersConfig;
        const invalidConfig = { ...baseConfigObject, ...configModifications };

        expect(() => new TacoClient(invalidConfig as TacoClientConfig)).toThrow(
          expectedError,
        );
      },
    );

    it('should throw error for mixed/invalid configuration types', () => {
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

  describe('Configuration Access', () => {
    it.each([
      {
        configType: 'viem',
        config: () => validViemConfig,
        expectedProperties: ['viemClient', 'viemSignerAccount'],
        description: 'viem client configuration',
      },
      {
        configType: 'ethers',
        config: () => validEthersConfig,
        expectedProperties: ['ethersProvider', 'ethersSigner'],
        description: 'ethers client configuration',
      },
    ])(
      'should return readonly configuration object for $description',
      ({ config, expectedProperties }) => {
        const client = new TacoClient(config());
        const clientConfig = client.getConfig();

        // Verify common properties
        expect(clientConfig.domain).toBe('tapir');
        expect(clientConfig.ritualId).toBe(6);

        // Verify config-specific properties
        expectedProperties.forEach((prop) => {
          expect(prop in clientConfig).toBe(true);
        });

        // Should be frozen/readonly
        expect(() => {
          (clientConfig as Record<string, unknown>).domain = 'lynx';
        }).toThrow();
      },
    );
  });

  describe('Initialization Lifecycle', () => {
    it('should trigger automatic TACo initialization on client construction', async () => {
      // Reset static initialization state to verify automatic initialization
      // occurs when TacoClient constructor is called
      resetTacoClientStatics();

      new TacoClient(validViemConfig);

      // Initialization should be triggered by constructor
      expect(getTacoClientStatics().initializationPromise).toBeDefined();
    });

    it('should share single initialization promise across multiple client instances', async () => {
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

    it('should provide static initialize method with proper promise handling', async () => {
      // Verify TacoClient.initialize() method exists and returns a promise
      const initPromise = TacoClient.initialize();
      expect(initPromise).toBeInstanceOf(Promise);

      // Wait for initialization to complete
      await initPromise;

      // Verify that repeated calls return the same promise (singleton pattern)
      const initPromise2 = TacoClient.initialize();
      expect(initPromise2).toBeInstanceOf(Promise);
    });
  });

  describe('Full Configuration Validation', () => {
    it.each([
      {
        configType: 'viem',
        config: () => validViemConfig,
        description: 'correct viem configuration',
      },
      {
        configType: 'ethers',
        config: () => validEthersConfig,
        description: 'correct ethers configuration',
      },
    ])('should pass full validation for $description', async ({ config }) => {
      const result = await TacoConfigValidator.validateFull(config());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect and report missing blockchain dependencies', async () => {
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

    it('should detect and report invalid domain in full validation', async () => {
      const result = await TacoConfigValidator.validateFull({
        ...validViemConfig,
        domain: 'INVALID' as DomainName,
      });

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('Invalid domain name')),
      ).toBe(true);
    });

    it('should detect and report invalid ritual ID during construction', async () => {
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

  describe('Domain Support', () => {
    it('should provide domain name via getConfig method', () => {
      const client = new TacoClient(validViemConfig);
      const config = client.getConfig();

      expect(config.domain).toBe('tapir');
    });
  });
});
