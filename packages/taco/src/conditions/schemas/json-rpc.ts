import { z } from 'zod';

import { baseConditionSchema, httpsURLSchema, jsonPathSchema } from './common';
import { contextParamSchema } from './context';
import { returnValueTestSchema } from './return-value-test';

export const JsonRpcConditionType = 'json-rpc';

export const jsonRpcConditionSchema = baseConditionSchema.extend({
  conditionType: z.literal(JsonRpcConditionType).default(JsonRpcConditionType),
  endpoint: httpsURLSchema,
  method: z.string(),
  // list or dictionary
  params: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional(),
  query: jsonPathSchema.optional(),
  authorizationToken: contextParamSchema.optional(),
  returnValueTest: returnValueTestSchema,
});

export type JsonRpcConditionProps = z.infer<typeof jsonRpcConditionSchema>;
