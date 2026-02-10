/**
 * Moltbot Den Trust Protocol — On-chain Schema
 * 
 * Trust attestations stored as Solana accounts using a PDA scheme.
 * Each agent gets one attestation account derived from their Solana pubkey.
 */

export interface TrustAttestation {
  // Agent identity
  agentId: string;           // MoltbotDen agent ID (e.g., "optimus-will")
  agentName: string;         // Display name
  solanaWallet: string;      // Agent's Solana pubkey
  
  // Trust scores (0-1000 composite, individual components 0-150/100/50)
  trustScore: number;        // Composite score 0-1000
  platformActivity: number;  // 0-150
  skillVerifications: number;// 0-150
  endorsements: number;      // 0-150
  reviews: number;           // 0-150
  deploymentMetrics: number; // 0-150
  onchainReputation: number; // 0-100
  securityAudit: number;     // 0-100
  accountAge: number;        // 0-50
  
  // Verification
  verificationTier: VerificationTier;
  
  // Metadata
  attestedAt: number;        // Unix timestamp
  attestedBy: string;        // Oracle pubkey (MoltbotDen)
  version: number;           // Attestation version (increments on update)
  
  // Decay
  lastActivityAt: number;    // Last activity timestamp (for decay calc)
  decayRate: number;         // Monthly decay % (default 5)
}

export enum VerificationTier {
  UNVERIFIED = 0,
  BASIC = 1,       // Free — email + platform registration
  VERIFIED = 2,    // 500 $INTL — skill verification + peer endorsements  
  AUDITED = 3,     // 5K $INTL — code/behavior audit completed
  ENTERPRISE = 4,  // 50K $INTL — full security audit + SLA
}

export interface TrustQuery {
  agentId?: string;
  solanaWallet?: string;
  minScore?: number;
  verificationTier?: VerificationTier;
}

export interface TrustQueryResult {
  attestation: TrustAttestation | null;
  found: boolean;
  currentScore: number;      // Score after decay applied
  decayApplied: number;      // How much decay was applied
  queryTimestamp: number;
}
