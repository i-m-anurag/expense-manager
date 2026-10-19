// Shapes shared by the parser engine, the template build step and the app.

export type TxnType =
  | 'upi'
  | 'debit_card'
  | 'credit_card'
  | 'neft'
  | 'imps'
  | 'rtgs'
  | 'atm'
  | 'auto_debit'
  | 'salary'
  | 'refund'
  | 'transfer'
  | 'other';

export type Direction = 'debit' | 'credit';

export type IgnoreReason = 'otp' | 'promo' | 'failed' | 'balance' | 'other';

// Template as written in parsers/*.yaml (after YAML → JSON).
export interface TemplateSource {
  bank: string;
  code: string;
  senders: string[];
  ignore?: {pattern: string; reason?: IgnoreReason}[];
  patterns: PatternSource[];
}

export interface PatternSource {
  id: string;
  type: TxnType;
  direction: Direction;
  account_kind?: 'account' | 'card';
  regex: string;
  date_format?: string;
  type_overrides?: {when: string; type: TxnType}[];
}

export interface RawSms {
  // Android inbox row id, when known.
  id?: string;
  sender: string;
  body: string;
  // Epoch milliseconds the phone received the message.
  receivedAt: number;
}

export interface ParsedTxn {
  bankCode: string;
  patternId: string;
  type: TxnType;
  direction: Direction;
  // Integer paise, so money math never touches floats.
  amountPaise: number;
  // Last 4 digits of the account or card, if present.
  accountMask: string | null;
  accountKind: 'account' | 'card';
  merchantRaw: string | null;
  merchantKey: string | null;
  referenceNo: string | null;
  // Epoch milliseconds.
  occurredAt: number;
  balancePaise: number | null;
  availableLimitPaise: number | null;
  smsId?: string;
}

export type ParseResult =
  | {status: 'parsed'; txn: ParsedTxn}
  | {status: 'ignored'; bankCode: string; reason: IgnoreReason}
  | {status: 'unparsed'; bankCode: string}
  | {status: 'not_bank'};
