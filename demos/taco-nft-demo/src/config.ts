import { domains } from '@nucypher-experimental/taco';

export const DEFAULT_RITUAL_ID = parseInt(process.env.DEFAULT_RITUAL_ID || '6');
export const DEFAULT_DOMAIN = process.env.DEFAULT_DOMAIN || domains.TESTNET;
