import type { ParsedTxn } from '@expense-manager/parser';
import { suggestBucket } from '@expense-manager/parser';
import type { MemoryEntry } from '../db/merchantMemory';
import { HIGH_CONFIDENCE_TAGS } from '../db/merchantMemory';
import type { CategorizationSource, Confidence } from '../db/transactions';

export interface Categorization {
  categoryId: string | null;
  suggestedId: string | null;
  source: CategorizationSource;
  confidence: Confidence;
}

// Well-known merchants → default sub-category. Used only as a suggestion until
// the user confirms; their own choices always win.
const DEFAULT_CATEGORY: Record<string, string> = {
  swiggy: 'want.food_delivery',
  zomato: 'want.food_delivery',
  eatsure: 'want.food_delivery',
  dominos: 'want.dining_out',
  mcdonalds: 'want.dining_out',
  starbucks: 'want.dining_out',
  amazon: 'want.shopping',
  flipkart: 'want.shopping',
  myntra: 'want.shopping',
  ajio: 'want.shopping',
  nykaa: 'want.shopping',
  netflix: 'want.subscriptions',
  spotify: 'want.subscriptions',
  hotstar: 'want.subscriptions',
  primevideo: 'want.subscriptions',
  youtube: 'want.subscriptions',
  bookmyshow: 'want.entertainment',
  makemytrip: 'want.travel',
  goibibo: 'want.travel',
  irctc: 'want.travel',
  indigo: 'want.travel',
  blinkit: 'need.groceries',
  zepto: 'need.groceries',
  bigbasket: 'need.groceries',
  dmart: 'need.groceries',
  jiomart: 'need.groceries',
  uber: 'need.commute',
  ola: 'need.commute',
  rapido: 'need.commute',
  metro: 'need.commute',
  indianoil: 'need.commute',
  hpcl: 'need.commute',
  bpcl: 'need.commute',
  airtel: 'need.utilities',
  jio: 'need.utilities',
  vi: 'need.utilities',
  bsnl: 'need.utilities',
  tatapower: 'need.utilities',
  bescom: 'need.utilities',
  apollopharmacy: 'need.medical',
  pharmeasy: 'need.medical',
  tata1mg: 'need.medical',
  lic: 'need.insurance',
  hdfcmf: 'investment.sip',
  zerodha: 'investment.stocks',
  groww: 'investment.sip',
  bajajfinance: 'loan.personal_loan',
};

export function defaultCategoryFor(t: ParsedTxn): string | null {
  if (t.merchantKey && DEFAULT_CATEGORY[t.merchantKey]) {
    return DEFAULT_CATEGORY[t.merchantKey];
  }
  const bucket = suggestBucket(t);
  return bucket ? `${bucket}.other` : null;
}

interface Context {
  isTransfer: 'self' | 'card_bill' | 'atm' | null;
  memory: MemoryEntry | null;
  // CAT-04: category of a similar earlier payment to the same person, if any.
  p2pMatch: string | null;
}

// Flow 8.1 step 4: transfers → merchant memory → P2P pattern → defaults → ask.
export function categorize(t: ParsedTxn, ctx: Context): Categorization {
  if (ctx.isTransfer) {
    return {
      categoryId: `transfer.${ctx.isTransfer}`,
      suggestedId: null,
      source: 'pattern',
      confidence: 'high',
    };
  }
  if (t.direction === 'credit') {
    const id =
      t.type === 'salary'
        ? 'income.salary'
        : t.type === 'refund'
        ? 'income.refund'
        : 'income.other';
    return {
      categoryId: id,
      suggestedId: null,
      source: 'pattern',
      confidence: t.type === 'salary' ? 'high' : 'medium',
    };
  }
  if (ctx.memory) {
    const high = ctx.memory.tag_count >= HIGH_CONFIDENCE_TAGS;
    return high
      ? {
          categoryId: ctx.memory.category_id,
          suggestedId: null,
          source: 'memory',
          confidence: 'high',
        }
      : {
          categoryId: null,
          suggestedId: ctx.memory.category_id,
          source: 'memory',
          confidence: 'medium',
        };
  }
  if (ctx.p2pMatch) {
    return {
      categoryId: null,
      suggestedId: ctx.p2pMatch,
      source: 'pattern',
      confidence: 'medium',
    };
  }
  const fallback = defaultCategoryFor(t);
  return {
    categoryId: null,
    suggestedId: fallback,
    source: fallback ? 'pattern' : 'none',
    confidence: fallback ? 'medium' : 'low',
  };
}
