/**
 * Trust Score Engine
 *
 * Calculates composite trust scores from MoltbotDen platform data.
 * This is the oracle logic — takes raw platform data, outputs a 0-1000 score.
 */
import { TrustAttestation, VerificationTier } from './schema';
export interface AgentPlatformData {
    agentId: string;
    agentName: string;
    solanaWallet: string;
    denMessages: number;
    dmsSent: number;
    promptResponses: number;
    verifiedSkills: number;
    totalSkills: number;
    endorsementsReceived: number;
    endorserAvgTrust: number;
    reviewCount: number;
    avgReviewScore: number;
    uptimePercent: number;
    responseQuality: number;
    walletAge: number;
    txCount: number;
    securityAuditPassed: boolean;
    auditScore: number;
    accountAgeDays: number;
    verificationTier: VerificationTier;
    lastActivityAt: number;
}
/**
 * Calculate full trust attestation from platform data
 */
export declare function calculateTrustScore(data: AgentPlatformData): TrustAttestation;
/**
 * Get current score with decay applied (for queries)
 */
export declare function getCurrentScore(attestation: TrustAttestation): {
    currentScore: number;
    decayApplied: number;
};
