/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import type {
  PublicClient,
  SignerAccount,
} from '@nucypher-experimental/shared';

describe('viem types', () => {
  it('should support viem-like client objects', () => {
    const viemLikeClient: PublicClient = {
      getChainId: () => Promise.resolve(80002),
      call: (params: any) => Promise.resolve('0x1234'),
    } as any;

    expect(viemLikeClient.getChainId).toBeDefined();
    expect(viemLikeClient.call).toBeDefined();
  });

  it('should support viem-like account objects', () => {
    const viemLikeAccount: SignerAccount = {
      address: '0x742d35Cc6632C0532c718F63b1a8D7d8a7fAd3b2',
      signMessage: () => Promise.resolve('0xsignature'),
    } as any;

    expect(viemLikeAccount.address).toBeDefined();
    expect(viemLikeAccount.signMessage).toBeDefined();
  });
});
