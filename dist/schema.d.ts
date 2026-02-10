/**
 * Moltbot Den Trust Protocol — On-chain Schema
 *
 * Trust attestations stored as Solana accounts using a PDA scheme.
 * Each agent gets one attestation account derived from their Solana pubkey.
 */
export interface TrustAttestation {
    agentId: string;
    agentName: string;
    solanaWallet: string;
    trustScore: number;
    platformActivity: number;
    skillVerifications: number;
    endorsements: number;
    reviews: number;
    deploymentMetrics: number;
    onchainReputation: number;
    securityAudit: number;
    accountAge: number;
    verificationTier: VerificationTier;
    attestedAt: number;
    attestedBy: string;
    version: number;
    lastActivityAt: number;
    decayRate: number;
}
export declare enum VerificationTier {
    UNVERIFIED = 0,
    BASIC = 1,// Free — email + platform registration
    VERIFIED = 2,// 500 $INTL — skill verification + peer endorsements  
    AUDITED = 3,// 5K $INTL — code/behavior audit completed
    ENTERPRISE = 4
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
    currentScore: number;
    decayApplied: number;
    queryTimestamp: number;
}
