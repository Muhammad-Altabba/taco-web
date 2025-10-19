import { ChainId } from '@nucypher-experimental/shared';
import {
  AuthProvider,
  USER_ADDRESS_PARAM_DEFAULT,
} from '@nucypher-experimental/taco-auth';
import { EIP4361, fakeAuthProviders } from '@nucypher-experimental/test-utils';
import { beforeAll, describe, expect, it } from 'vitest';

import { initialize } from '../../src';
import { CompoundCondition } from '../../src/conditions/compound-condition';
import { ConditionContext } from '../../src/conditions/context';

describe('conditions', () => {
  let authProviders: Record<string, AuthProvider>;
  beforeAll(async () => {
    await initialize();
    authProviders = await fakeAuthProviders();
  });

  it('creates a complex condition with custom parameters', async () => {
    const hasPositiveBalance = {
      chain: ChainId.AMOY,
      method: 'eth_getBalance',
      parameters: [':userAddress', 'latest'],
      returnValueTest: {
        comparator: '>',
        value: 0,
      },
    };
    const timeIsGreaterThan = {
      chain: ChainId.SEPOLIA,
      method: 'blocktime',
      returnValueTest: {
        comparator: '>',
        value: ':time',
      },
    };
    const condition = new CompoundCondition({
      operator: 'and',
      operands: [hasPositiveBalance, timeIsGreaterThan],
    });
    expect(condition).toBeDefined();
    expect(condition.requiresAuthentication()).toBeTruthy();

    const context = new ConditionContext(condition);
    context.addCustomContextParameterValues({ ':time': 100 });
    context.addAuthProvider(USER_ADDRESS_PARAM_DEFAULT, authProviders[EIP4361]);

    expect(context).toBeDefined();

    const asObj = await context.toContextParameters();
    expect(asObj).toBeDefined();
    expect(asObj[':time']).toBe(100);
  });
});
