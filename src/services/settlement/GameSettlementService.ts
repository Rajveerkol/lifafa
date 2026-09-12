// ====================================================================
// GameSettlementService.ts
// PRODUCTION BOUNDARY: Isolated Settlement Abstraction
// 
// Architectural isolation requirement:
// Defines clean operations for future approved settlement providers.
// STRICTLY decoupled from wallets, withdrawals, and PayRupee.
// Zero cash-prize wagering flow is implemented in this phase.
// ====================================================================

export interface EntryIntentParams {
  matchId: string;
  userId: string;
  entryType: 'TICKET' | 'TEST_CREDIT';
  amount: number;
}

export interface EntryIntentResult {
  intentId: string;
  matchId: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  timestamp: string;
}

export interface MatchFinalizationResult {
  matchId: string;
  winnerId: string | null;
  isDraw: boolean;
  finalScores: Record<string, number>;
}

export interface RewardResult {
  rewardId: string;
  matchId: string;
  recipientId: string;
  rewardType: 'TICKET' | 'TEST_CREDIT';
  amount: number;
  status: 'ISSUED' | 'FAILED';
}

export interface IGameSettlementProvider {
  /**
   * Creates an entry intent prior to match start.
   */
  createEntryIntent(params: EntryIntentParams): Promise<EntryIntentResult>;

  /**
   * Confirms entry lock before countdown.
   */
  confirmEntry(intentId: string): Promise<boolean>;

  /**
   * Authoritatively records match conclusion.
   */
  finalizeMatch(result: MatchFinalizationResult): Promise<void>;

  /**
   * Issues game credits or non-monetary rewards to the verified winner.
   */
  issueReward(matchId: string, winnerId: string, amount: number): Promise<RewardResult>;

  /**
   * Safely refunds entry if a match is cancelled or aborted during queue.
   */
  refundEntry(intentId: string, reason: string): Promise<boolean>;
}

/**
 * Phase 1 Non-Monetary Settlement Implementation
 * Operates purely in-memory with game credits.
 * Never calls real-money wallet or PayRupee endpoints.
 */
export class NonMonetarySettlementProvider implements IGameSettlementProvider {
  private intents: Map<string, EntryIntentResult> = new Map();

  async createEntryIntent(params: EntryIntentParams): Promise<EntryIntentResult> {
    const intentId = `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const result: EntryIntentResult = {
      intentId,
      matchId: params.matchId,
      status: 'CONFIRMED',
      timestamp: new Date().toISOString(),
    };
    this.intents.set(intentId, result);
    return result;
  }

  async confirmEntry(intentId: string): Promise<boolean> {
    const intent = this.intents.get(intentId);
    if (!intent) return false;
    intent.status = 'CONFIRMED';
    return true;
  }

  async finalizeMatch(result: MatchFinalizationResult): Promise<void> {
    // In Phase 1, match finalization is authoritatively recorded server-side
    // without invoking any real monetary transactions.
  }

  async issueReward(matchId: string, winnerId: string, amount: number): Promise<RewardResult> {
    return {
      rewardId: `rew_${Date.now()}`,
      matchId,
      recipientId: winnerId,
      rewardType: 'TICKET',
      amount,
      status: 'ISSUED',
    };
  }

  async refundEntry(intentId: string, reason: string): Promise<boolean> {
    const intent = this.intents.get(intentId);
    if (intent) {
      intent.status = 'REJECTED';
    }
    return true;
  }
}

// Active singleton instance for the game engine
export const GameSettlementService = new NonMonetarySettlementProvider();
