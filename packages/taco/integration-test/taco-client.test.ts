import { beforeAll, describe, expect, test } from 'vitest';

import { fromBytes, toBytes } from '@nucypher/shared';
import {
  EIP4361AuthProvider,
  USER_ADDRESS_PARAM_DEFAULT,
} from '@nucypher/taco-auth';
import { ethers } from 'ethers';
import { createPublicClient, http, LocalAccount } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import {
  conditions,
  initialize,
  TacoClient,
  TacoClientEthersConfig,
  TacoClientViemConfig,
  ThresholdMessageKit,
} from '../src';
import { DkgClient } from '../src/dkg';

const RPC_PROVIDER_URL = 'https://rpc-amoy.polygon.technology';
const ENCRYPTOR_PRIVATE_KEY =
  '0x900edb9e8214b2353f82aa195e915128f419a92cfb8bbc0f4784f10ef4112b86';
const CONSUMER_PRIVATE_KEY =
  '0xf307e165339cb5deb2b8ec59c31a5c0a957b8e8453ce7fe8a19d9a4c8acf36d4';
const DOMAIN = 'lynx';
const RITUAL_ID = 27;
const CHAIN_ID = 80002; // Polygon Amoy

// temp type-safe configuration interfaces just for this testing file
type ViemTestConfig = Omit<TacoClientViemConfig, 'domain' | 'ritualId'>;
type EthersTestConfig = Omit<TacoClientEthersConfig, 'domain' | 'ritualId'>;

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
    // Create viem clients for correct network (Polygon Amoy)
    const viemPublicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(RPC_PROVIDER_URL),
    });
    const viemTestConfig: ViemTestConfig = {
      viemClient: viemPublicClient,
      viemSignerAccount: encryptorAccount,
    };

    // Create ethers clients for correct network (Polygon Amoy)
    const ethersProvider = new ethers.providers.JsonRpcProvider(
      RPC_PROVIDER_URL,
    );
    const encryptorSigner = new ethers.Wallet(
      ENCRYPTOR_PRIVATE_KEY,
      ethersProvider,
    );
    const consumerSigner = new ethers.Wallet(
      CONSUMER_PRIVATE_KEY,
      ethersProvider,
    );

    const ethersTestConfig: EthersTestConfig = {
      ethersProvider,
      ethersSigner: encryptorSigner,
    };

    beforeAll(async () => {
      // Initialize the TACo library
      await initialize();

      // Verify both clients are connected to the correct network
      const [viemChainId, ethersNetwork] = await Promise.all([
        viemPublicClient.getChainId(),
        ethersProvider.getNetwork(),
      ]);

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
    }, 10000);

    const createTestCondition = () => {
      return new conditions.base.rpc.RpcCondition({
        chain: CHAIN_ID,
        method: 'eth_getBalance',
        parameters: [':userAddress', 'latest'],
        returnValueTest: {
          comparator: '>=',
          value: 0,
        },
      });
    };

    const createAuthProvider = (
      config: ViemTestConfig | EthersTestConfig,
      customSigner?: ethers.Wallet | LocalAccount,
    ) => {
      const provider =
        (config as EthersTestConfig).ethersProvider ??
        (config as ViemTestConfig).viemClient;
      const signerToUse =
        customSigner ??
        (config as EthersTestConfig).ethersSigner ??
        (config as ViemTestConfig).viemSignerAccount;

      return new EIP4361AuthProvider(provider, signerToUse as any);
    };

    const setupConditionContext = async (
      messageKit: ThresholdMessageKit,
      config: ViemTestConfig | EthersTestConfig,
      customSigner?: ethers.Wallet | LocalAccount,
    ) => {
      const conditionContext =
        conditions.context.ConditionContext.fromMessageKit(messageKit);

      const authProvider = createAuthProvider(config, customSigner);
      conditionContext.addAuthProvider(
        USER_ADDRESS_PARAM_DEFAULT,
        authProvider,
      );

      return conditionContext;
    };

    describe
      .skipIf(!process.env.RUNNING_IN_CI)
      .each<
        | ['ethers', EthersTestConfig, ethers.Wallet]
        | ['viem', ViemTestConfig, LocalAccount]
      >([
        ['ethers', ethersTestConfig, consumerSigner],
        ['viem', viemTestConfig, consumerAccount],
      ])('TacoClient with %s', (label, objects, consumerSigner) => {
      test('should encrypt and decrypt a message using standard encrypt method', async () => {
        // Setup
        const tacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          ...objects,
        });

        // Create test message and condition
        const messageString = `This is a secret message from TacoClient with ${label} 🤐`;
        const message = toBytes(messageString);
        const condition = createTestCondition();

        // Encrypt the message
        const messageKit = await tacoClient.encrypt(message, condition);
        expect(messageKit).toBeInstanceOf(ThresholdMessageKit);
        expect(messageKit.toBytes()).toBeInstanceOf(Uint8Array);

        // Setup condition context for decryption
        const conditionContext = await setupConditionContext(
          messageKit,
          objects,
          consumerSigner,
        );

        // Test decryption with Uint8Array input
        const decryptedBytes = await tacoClient.decrypt(
          messageKit.toBytes(),
          conditionContext,
        );
        const decryptedMessageString = fromBytes(decryptedBytes);
        expect(decryptedMessageString).toEqual(messageString);

        // Test decryption with MessageKit object input
        const decryptedBytes2 = await tacoClient.decrypt(
          messageKit,
          conditionContext,
        );
        const decryptedMessageString2 = fromBytes(decryptedBytes2);
        expect(decryptedMessageString2).toEqual(messageString);
      }, 30000);

      test('should encrypt and decrypt using offline encryptWithPublicKey method', async () => {
        // Create TacoClient from configuration
        const tacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          ...objects,
        });

        const messageString = 'This is an offline encrypted message 🔐';
        const message = toBytes(messageString);
        const condition = createTestCondition();

        // Get DKG public key from ritual for offline encryption
        const dkgRitual = await DkgClient.getActiveRitual(
          ethersProvider,
          DOMAIN,
          RITUAL_ID,
        );
        const dkgPublicKey = dkgRitual.dkgPublicKey;
        expect(dkgPublicKey).toBeDefined();

        // Perform offline encryption with DKG public key
        const messageKit = await tacoClient.encryptWithPublicKey(
          message,
          condition,
          dkgPublicKey,
        );
        expect(messageKit).toBeInstanceOf(ThresholdMessageKit);
        expect(messageKit.toBytes()).toBeInstanceOf(Uint8Array);

        // Setup condition context with consumer signer for decryption
        const conditionContext = await setupConditionContext(
          messageKit,
          objects,
          consumerSigner,
        );

        // Decrypt and verify
        const decryptedBytes = await tacoClient.decrypt(
          messageKit,
          conditionContext,
        );
        const decryptedMessageString = fromBytes(decryptedBytes);
        expect(decryptedMessageString).toEqual(messageString);
      }, 15000);

      test('should successfully validate network configuration', async () => {
        // Setup
        const tacoClient = new TacoClient({
          domain: DOMAIN,
          ritualId: RITUAL_ID,
          ...objects,
        });

        // Validate configuration with network calls
        const validation = await tacoClient.validateConfig();

        // Verify validation results
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }, 10000);
    });
  },
);
