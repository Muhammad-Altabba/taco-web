import { fakeUrsulas } from '@nucypher-experimental/test-utils';
import axios, { HttpStatusCode } from 'axios';
import { MockInstance, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  GetUrsulasResult,
  PorterClient,
  Ursula,
  domains,
  getPorterUris,
  getPorterUrisFromSource,
  initialize,
  toHexString,
} from '../src';

const fakePorterUris = [
  'https://_this_should_crash.com/',
  'https://2_this_should_crash.com/',
  'https://_this_should_work.com/',
];

const mockGetUrsulas = (ursulas: Ursula[] = fakeUrsulas()): MockInstance => {
  const fakePorterUrsulas = (
    mockUrsulas: readonly Ursula[],
  ): GetUrsulasResult => {
    return {
      result: {
        ursulas: mockUrsulas.map(({ encryptingKey, uri, checksumAddress }) => ({
          encrypting_key: toHexString(encryptingKey.toCompressedBytes()),
          uri: uri,
          checksum_address: checksumAddress,
        })),
      },
      version: '5.2.0',
    };
  };

  return vi.spyOn(axios, 'request').mockImplementation(async (config) => {
    switch (config.baseURL) {
      case fakePorterUris[2]:
        return Promise.resolve({
          status: HttpStatusCode.Ok,
          data: fakePorterUrsulas(ursulas),
        });
      case fakePorterUris[1]:
        return Promise.resolve({ status: HttpStatusCode.BadRequest, data: '' });
      case fakePorterUris[0]:
        throw new Error(`Test error`);
    }
  });
};

describe('getPorterUris', () => {
  beforeAll(async () => {
    await initialize();
  });

  it('Get URIs from source', async () => {
    for (const domain of Object.values(domains)) {
      const uris = await getPorterUrisFromSource(domain);
      expect(uris.length).toBeGreaterThanOrEqual(0);
      const fullList = await getPorterUris(domain);
      expect(fullList).toEqual(expect.arrayContaining(uris));
    }
  });
});

describe('PorterClient', () => {
  beforeAll(async () => {
    await initialize();
  });

  it('should work when at least one ursula URI is valid', async () => {
    const ursulas = fakeUrsulas();
    const getUrsulasSpy = mockGetUrsulas(ursulas);
    const porterClient = new PorterClient(fakePorterUris);
    const result = await porterClient.getUrsulas(ursulas.length);

    expect(
      result.every((u: Ursula, index: number) => {
        const expectedUrsula = ursulas[index];
        return (
          u.checksumAddress === expectedUrsula.checksumAddress &&
          u.uri === expectedUrsula.uri &&
          u.encryptingKey.equals(expectedUrsula.encryptingKey)
        );
      }),
    ).toBeTruthy();
    const params = {
      method: 'get',
      url: '/get_ursulas',
      params: {
        exclude_ursulas: [],
        include_ursulas: [],
        quantity: ursulas.length,
      },
    };

    expect(getUrsulasSpy).toBeCalledTimes(fakePorterUris.length);
    fakePorterUris.forEach((value, index) => {
      expect(getUrsulasSpy).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({ ...params, baseURL: value }),
      );
    });
  });

  it('returns error in case all porters fail', async () => {
    const ursulas = fakeUrsulas();
    mockGetUrsulas(ursulas);
    let porterClient = new PorterClient([fakePorterUris[1]]);
    await expect(porterClient.getUrsulas(ursulas.length)).rejects.toThrowError(
      Error(`Porter returned bad response: 400 - `),
    );
    porterClient = new PorterClient([fakePorterUris[1], fakePorterUris[0]]);
    await expect(porterClient.getUrsulas(ursulas.length)).rejects.toThrowError(
      Error(`Test error`),
    );
  });
});
