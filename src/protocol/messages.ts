import * as z from 'zod/mini';
import { phoneActionSchema, type PhoneAction } from './actions';
import { publicViewSchema, type PublicView } from './view';

/** Bumped for the toss-up: phones and TVs must run the same version. */
export const PROTOCOL_VERSION = 3;

const version = z.literal(PROTOCOL_VERSION);
const heartbeatSchema = z.object({ v: version, type: z.literal('heartbeat') });

export type HeartbeatMessage = z.infer<typeof heartbeatSchema>;

const phoneMessageSchema = z.discriminatedUnion('type', [
  z.object({ v: version, type: z.literal('action'), action: phoneActionSchema }),
  heartbeatSchema,
]);

const tvMessageSchema = z.discriminatedUnion('type', [
  z.object({ v: version, type: z.literal('state'), view: publicViewSchema }),
  heartbeatSchema,
]);

/** Phone → TV. */
export type PhoneMessage = z.infer<typeof phoneMessageSchema>;
/** TV → phone. */
export type TvMessage = z.infer<typeof tvMessageSchema>;

export type ParseResult<T> =
  { ok: true; message: T } | { ok: false; reason: 'version' | 'invalid' };

export const HEARTBEAT: HeartbeatMessage = { v: PROTOCOL_VERSION, type: 'heartbeat' };

export function actionMessage(action: PhoneAction): PhoneMessage {
  return { v: PROTOCOL_VERSION, type: 'action', action };
}

export function stateMessage(view: PublicView): TvMessage {
  return { v: PROTOCOL_VERSION, type: 'state', view };
}

const envelopeSchema = z.object({ v: z.number() });

function parseWith<T>(schema: z.ZodMiniType<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, message: result.data };
  const envelope = envelopeSchema.safeParse(data);
  const otherVersion = envelope.success && envelope.data.v !== PROTOCOL_VERSION;
  return { ok: false, reason: otherVersion ? 'version' : 'invalid' };
}

export function parsePhoneMessage(data: unknown): ParseResult<PhoneMessage> {
  return parseWith(phoneMessageSchema, data);
}

export function parseTvMessage(data: unknown): ParseResult<TvMessage> {
  return parseWith(tvMessageSchema, data);
}
