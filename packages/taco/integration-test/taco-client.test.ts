import { beforeAll, describe, expect, test } from 'vitest';

import { fromBytes, toBytes } from '@nucypher/shared';
import { PublicClient, WalletClient } from '@nucypher/shared/src/viem-utils';
import {
  EIP4361AuthProvider,
  USER_ADDRESS_PARAM_DEFAULT,
  ViemEIP4361AuthProvider,
} from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy, sepolia } from 'viem/chains';
import {
  conditions,
  decrypt,
  encrypt,
  initialize,
  TacoClient,
  ThresholdMessageKit,
} from '../src';
import { CompoundCondition } from '../src/conditions/compound-condition';
import {
  decrypt as viemDecrypt,
  encrypt as viemEncrypt,
} from '../src/viem-taco';
import { UINT256_MAX } from '../test/test-utils';

const RPC_PROVIDER_URL = 'https://rpc-amoy.polygon.technology';
const SEPOLIA_RPC_URL = 'https://sepolia.drpc.org';
const ENCRYPTOR_PRIVATE_KEY =
  '0x900edb9e8214b2353f82aa195e915128f419a92cfb8bbc0f4784f10ef4112b86';
const CONSUMER_PRIVATE_KEY =
  '0xf307e165339cb5deb2b8ec59c31a5c0a957b8e8453ce7fe8a19d9a4c8acf36d4';
const DOMAIN = 'lynx';
const RITUAL_ID = 27;
const CHAIN_ID = 80002; // Polygon Amoy
const INCOMPATIBLE_CHAIN_ID = 11155111; // Sepolia

// Create viem accounts from private keys
const encryptorAccount = privateKeyToAccount(
  ENCRYPTOR_PRIVATE_KEY as `0x${string}`,
);
const consumerAccount = privateKeyToAccount(
  CONSUMER_PRIVATE_KEY as `0x${string}`,
);

describe.skipIf(!process.env.RUNNING_IN_CI)(
  'TacoClient Integration Test',
  () => {
    let viemPublicClient: PublicClient;
    let viemWalletClient: WalletClient;
    let ethersProvider: ethers.providers.JsonRpcProvider;
    let encryptorSigner: ethers.Wallet;
    let consumerSigner: ethers.Wallet;

    // Incompatible providers (wrong chain)
    let incompatibleViemClient: PublicClient;
    let incompatibleEthersProvider: ethers.providers.JsonRpcProvider;

    beforeAll(async () => {
      // Create viem clients for correct network (Polygon Amoy)
      viemPublicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(RPC_PROVIDER_URL),
      });

      viemWalletClient = createWalletClient({
        account: consumerAccount,
        chain: polygonAmoy,
        transport: http(RPC_PROVIDER_URL),
      });

      // Create ethers clients for correct network (Polygon Amoy)
      ethersProvider = new ethers.providers.JsonRpcProvider(RPC_PROVIDER_URL);
      encryptorSigner = new ethers.Wallet(
        ENCRYPTOR_PRIVATE_KEY,
        ethersProvider,
      );
      consumerSigner = new ethers.Wallet(CONSUMER_PRIVATE_KEY, ethersProvider);

      // Create incompatible clients (wrong chain - Sepolia)
      incompatibleViemClient = createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC_URL),
      });

      incompatibleEthersProvider = new ethers.providers.JsonRpcProvider(
        SEPOLIA_RPC_URL,
      );

      // Initialize the library
      await initialize();

      // Verify network connection for correct clients
      const viemChainId = await viemPublicClient.getChainId();
      const ethersNetwork = await ethersProvider.getNetwork();

      if (viemChainId !== CHAIN_ID) {
        throw new Error(
          `Viem client connected to wrong network. Expected ${CHAIN_ID}, got ${viemChainId}`,
        );
      }

      if (ethersNetwork.chainId !== CHAIN_ID) {
        throw new Error(
          `Ethers provider connected to wrong network. Expected ${CHAIN_ID}, got ${ethersNetwork.chainId}`,
        );
      }
    });

    const createTestCondition = () => {
      const hasPositiveBalance = new conditions.base.rpc.RpcCondition({
        chain: CHAIN_ID,
        method: 'eth_getBalance',
        parameters: [':userAddress', 'latest'],
        returnValueTest: {
          comparator: '>=',
          value: 0,
        },
      });

      const balanceLessThanMaxUint = new conditions.base.rpc.RpcCondition({
        chain: CHAIN_ID,
        method: 'eth_getBalance',
        parameters: [':userAddress', 'latest'],
        returnValueTest: {
          comparator: '<',
          value: UINT256_MAX,
        },
      });

      return CompoundCondition.and([
        hasPositiveBalance,
        balanceLessThanMaxUint,
      ]);
    };

    describe('TacoClient with Viem', () => {
      test('should encrypt and decrypt a message using TacoClient with viem', async () => {
        // Create TacoClient with viem configuration
        const tacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          viemClient: viemPublicClient,
          viemAccount: encryptorAccount,
        });

        // Create test message and condition
        const messageString =
          'This is a secret message from TacoClient with viem 🤐';
        const message = toBytes(messageString);
        const condition = createTestCondition();

        // Encrypt using TacoClient
        const messageKit = await tacoClient.encrypt(message, condition);
        expect(messageKit).toBeInstanceOf(ThresholdMessageKit);

        // Prepare condition context for decryption
        const conditionContext =
          conditions.context.ConditionContext.fromMessageKit(messageKit);

        if (
          conditionContext.requestedContextParameters.has(
            USER_ADDRESS_PARAM_DEFAULT,
          )
        ) {
          const authProvider = await ViemEIP4361AuthProvider.create(
            viemPublicClient,
            consumerAccount,
          );
          conditionContext.addAuthProvider(
            USER_ADDRESS_PARAM_DEFAULT,
            authProvider,
          );
        }

        // Decrypt using TacoClient
        const decryptedBytes = await tacoClient.decrypt(
          messageKit,
          conditionContext,
        );
        const decryptedMessageString = fromBytes(decryptedBytes);

        // Verify decryption
        expect(decryptedMessageString).toEqual(messageString);
      }, 15000);

      test('should throw error when viem client points to incompatible chain', async () => {
        // Try to create TacoClient with incompatible viem client
        expect(() => {
          new TacoClient({
            domain: DOMAIN,
            ritualId: RITUAL_ID,
            viemClient: incompatibleViemClient,
            viemAccount: encryptorAccount,
          });
        }).toThrow(/Invalid configuration/);
      });
    });

    describe('TacoClient with Ethers', () => {
      test('should encrypt and decrypt a message using TacoClient with ethers', async () => {
        // Create TacoClient with ethers configuration
        const tacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          ethersProvider: ethersProvider,
          ethersSigner: encryptorSigner,
        });

        // Create test message and condition
        const messageString =
          'This is a secret message from TacoClient with ethers 🤐';
        const message = toBytes(messageString);
        const condition = createTestCondition();

        // Encrypt using TacoClient
        const messageKit = await tacoClient.encrypt(message, condition);
        expect(messageKit).toBeInstanceOf(ThresholdMessageKit);

        // Prepare condition context for decryption
        const conditionContext =
          conditions.context.ConditionContext.fromMessageKit(messageKit);

        if (
          conditionContext.requestedContextParameters.has(
            USER_ADDRESS_PARAM_DEFAULT,
          )
        ) {
          const authProvider = new EIP4361AuthProvider(
            ethersProvider,
            consumerSigner,
          );
          conditionContext.addAuthProvider(
            USER_ADDRESS_PARAM_DEFAULT,
            authProvider,
          );
        }

        // Decrypt using TacoClient
        const decryptedBytes = await tacoClient.decrypt(
          messageKit,
          conditionContext,
        );
        const decryptedMessageString = fromBytes(decryptedBytes);

        // Verify decryption
        expect(decryptedMessageString).toEqual(messageString);
      }, 15000);

      test('should throw error when ethers provider points to incompatible chain', async () => {
        // Try to create TacoClient with incompatible ethers provider
        expect(() => {
          new TacoClient({
            domain: DOMAIN,
            ritualId: RITUAL_ID,
            ethersProvider: incompatibleEthersProvider,
            ethersSigner: new ethers.Wallet(
              ENCRYPTOR_PRIVATE_KEY,
              incompatibleEthersProvider,
            ),
          });
        }).toThrow(/Invalid configuration/);
      });
    });

    describe('Functional API Chain Compatibility', () => {
      test('should throw error when functional encrypt() uses incompatible viem client', async () => {
        const messageString = 'Test message for incompatible viem encrypt';
        const message = toBytes(messageString);
        const condition = createTestCondition();

        await expect(
          viemEncrypt(
            incompatibleViemClient,
            DOMAIN,
            message,
            condition,
            RITUAL_ID,
            encryptorAccount,
          ),
        ).rejects.toThrow();
      }, 10000);

      test('should throw error when functional encrypt() uses incompatible ethers provider', async () => {
        const messageString = 'Test message for incompatible ethers encrypt';
        const message = toBytes(messageString);
        const condition = createTestCondition();
        const incompatibleSigner = new ethers.Wallet(
          ENCRYPTOR_PRIVATE_KEY,
          incompatibleEthersProvider,
        );

        await expect(
          encrypt(
            incompatibleEthersProvider,
            DOMAIN,
            message,
            condition,
            RITUAL_ID,
            incompatibleSigner,
          ),
        ).rejects.toThrow();
      }, 10000);

      test('should throw error when functional decrypt() uses incompatible viem client', async () => {
        // First encrypt with correct client
        const messageString = 'Test message for decrypt compatibility';
        const message = toBytes(messageString);
        const condition = createTestCondition();

        const messageKit = await viemEncrypt(
          viemPublicClient,
          DOMAIN,
          message,
          condition,
          RITUAL_ID,
          encryptorAccount,
        );

        const conditionContext =
          conditions.context.ConditionContext.fromMessageKit(messageKit);

        // Try to decrypt with incompatible client
        await expect(
          viemDecrypt(
            incompatibleViemClient,
            DOMAIN,
            messageKit,
            conditionContext,
          ),
        ).rejects.toThrow();
      }, 10000);

      test('should throw error when functional decrypt() uses incompatible ethers provider', async () => {
        // First encrypt with correct provider
        const messageString = 'Test message for decrypt compatibility';
        const message = toBytes(messageString);
        const condition = createTestCondition();

        const messageKit = await encrypt(
          ethersProvider,
          DOMAIN,
          message,
          condition,
          RITUAL_ID,
          encryptorSigner,
        );

        const conditionContext =
          conditions.context.ConditionContext.fromMessageKit(messageKit);

        // Try to decrypt with incompatible provider
        await expect(
          decrypt(
            incompatibleEthersProvider,
            DOMAIN,
            messageKit,
            conditionContext,
          ),
        ).rejects.toThrow();
      }, 10000);
    });

    describe('TacoClient Configuration Validation', () => {
      test('should validate configuration successfully for compatible clients', async () => {
        const viemTacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          viemClient: viemPublicClient,
          viemAccount: encryptorAccount,
        });

        const ethersTacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          ethersProvider: ethersProvider,
          ethersSigner: encryptorSigner,
        });

        // Validate both configurations
        const viemValidation = await viemTacoClient.validateConfig();
        const ethersValidation = await ethersTacoClient.validateConfig();

        expect(viemValidation.isValid).toBe(true);
        expect(viemValidation.errors).toHaveLength(0);
        expect(ethersValidation.isValid).toBe(true);
        expect(ethersValidation.errors).toHaveLength(0);
      }, 10000);

      test('should return configuration via getConfig()', () => {
        const tacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          viemClient: viemPublicClient,
          viemAccount: encryptorAccount,
        });

        const config = tacoClient.getConfig();

        expect(config.domain).toBe(DOMAIN);
        expect(config.ritualId).toBe(RITUAL_ID);
        expect('viemClient' in config).toBe(true);
        expect('viemAccount' in config).toBe(true);
      });

      test('should throw error for invalid domain', () => {
        expect(() => {
          new TacoClient({
            domain: 'invalid-domain' as any,
            ritualId: RITUAL_ID,
            viemClient: viemPublicClient,
            viemAccount: encryptorAccount,
          });
        }).toThrow(/Invalid configuration/);
      });

      test('should throw error for invalid ritual ID', () => {
        expect(() => {
          new TacoClient({
            domain: DOMAIN,
            ritualId: -1,
            viemClient: viemPublicClient,
            viemAccount: encryptorAccount,
          });
        }).toThrow(/Invalid configuration/);
      });
    });
  },
);
