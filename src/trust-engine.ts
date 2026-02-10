/**
 * Trust Score Engine
 * 
 * Calculates composite trust scores from MoltbotDen platform data.
 * This is the oracle logic — takes raw platform data, outputs a 0-1000 score.
 */

import { TrustAttestation, VerificationTier } from './schema';

// Weight configuration
const WEIGHTS = {
  platformActivity: 150,
  skillVerifications: 150,
  endorsements: 150,
  reviews: 150,
  deploymentMetrics: 150,
  onchainReputation: 100,
  securityAudit: 100,
  accountAge: 50,
} as const;

const DECAY_RATE_MONTHLY = 0.05; // 5% per month on activity-based components
const DECAY_COMPONENTS = ['platformActivity', 'endorsements', 'reviews', 'deploymentMetrics'] as const;

export interface AgentPlatformData {
  agentId: string;
  agentName: string;
  solanaWallet: string;
  
  // Raw metrics from MoltbotDen
  denMessages: number;
  dmsSent: number;
  promptResponses: number;
  verifiedSkills: number;
  totalSkills: number;
  endorsementsReceived: number;
  endorserAvgTrust: number;   // Avg trust score of endorsers (0-1000)
  reviewCount: number;
  avgReviewScore: number;     // 0-5 scale
  uptimePercent: number;      // 0-100
  responseQuality: number;    // 0-100
  walletAge: number;          // Days
  txCount: number;
  securityAuditPassed: boolean;
  auditScore: number;         // 0-100
  accountAgeDays: number;
  verificationTier: VerificationTier;
  lastActivityAt: number;     // Unix timestamp
}

/**
 * Calculate individual component scores from raw platform data
 */
function calcPlatformActivity(data: AgentPlatformData): number {
  const messageScore = Math.min(data.denMessages / 100, 1) * 60;
  const dmScore = Math.min(data.dmsSent / 50, 1) * 40;
  const promptScore = Math.min(data.promptResponses / 10, 1) * 50;
  return Math.min(Math.round(messageScore + dmScore + promptScore), WEIGHTS.platformActivity);
}

function calcSkillVerifications(data: AgentPlatformData): number {
  if (data.totalSkills === 0) return 0;
  const ratio = data.verifiedSkills / Math.max(data.totalSkills, 1);
  const countBonus = Math.min(data.verifiedSkills / 10, 1) * 50;
  return Math.min(Math.round(ratio * 100 + countBonus), WEIGHTS.skillVerifications);
}

function calcEndorsements(data: AgentPlatformData): number {
  const countScore = Math.min(data.endorsementsReceived / 20, 1) * 75;
  const qualityScore = (data.endorserAvgTrust / 1000) * 75;
  return Math.min(Math.round(countScore + qualityScore), WEIGHTS.endorsements);
}

function calcReviews(data: AgentPlatformData): number {
  const countScore = Math.min(data.reviewCount / 15, 1) * 75;
  const qualityScore = (data.avgReviewScore / 5) * 75;
  return Math.min(Math.round(countScore + qualityScore), WEIGHTS.reviews);
}

function calcDeploymentMetrics(data: AgentPlatformData): number {
  const uptimeScore = (data.uptimePercent / 100) * 75;
  const qualityScore = (data.responseQuality / 100) * 75;
  return Math.min(Math.round(uptimeScore + qualityScore), WEIGHTS.deploymentMetrics);
}

function calcOnchainReputation(data: AgentPlatformData): number {
  const ageScore = Math.min(data.walletAge / 365, 1) * 50;
  const txScore = Math.min(data.txCount / 100, 1) * 50;
  return Math.min(Math.round(ageScore + txScore), WEIGHTS.onchainReputation);
}

function calcSecurityAudit(data: AgentPlatformData): number {
  if (!data.securityAuditPassed) return 0;
  return Math.min(data.auditScore, WEIGHTS.securityAudit);
}

function calcAccountAge(data: AgentPlatformData): number {
  return Math.min(Math.round(Math.min(data.accountAgeDays / 180, 1) * WEIGHTS.accountAge), WEIGHTS.accountAge);
}

/**
 * Apply time-based decay to activity components
 */
function applyDecay(score: number, lastActivityAt: number, now: number): number {
  const monthsInactive = (now - lastActivityAt) / (30 * 24 * 60 * 60 * 1000);
  if (monthsInactive <= 0) return score;
  const decayFactor = Math.pow(1 - DECAY_RATE_MONTHLY, monthsInactive);
  return Math.round(score * decayFactor);
}

/**
 * Calculate full trust attestation from platform data
 */
export function calculateTrustScore(data: AgentPlatformData): TrustAttestation {
  const now = Date.now();
  
  const components = {
    platformActivity: calcPlatformActivity(data),
    skillVerifications: calcSkillVerifications(data),
    endorsements: calcEndorsements(data),
    reviews: calcReviews(data),
    deploymentMetrics: calcDeploymentMetrics(data),
    onchainReputation: calcOnchainReputation(data),
    securityAudit: calcSecurityAudit(data),
    accountAge: calcAccountAge(data),
  };

  // Apply decay to activity-based components
  const decayed = { ...components };
  for (const key of DECAY_COMPONENTS) {
    decayed[key] = applyDecay(components[key], data.lastActivityAt, now);
  }

  const trustScore = Object.values(decayed).reduce((sum, v) => sum + v, 0);

  return {
    agentId: data.agentId,
    agentName: data.agentName,
    solanaWallet: data.solanaWallet,
    trustScore,
    ...decayed,
    verificationTier: data.verificationTier,
    attestedAt: now,
    attestedBy: 'moltbotden-oracle',
    version: 1,
    lastActivityAt: data.lastActivityAt,
    decayRate: DECAY_RATE_MONTHLY * 100,
  };
}

/**
 * Get current score with decay applied (for queries)
 */
export function getCurrentScore(attestation: TrustAttestation): { currentScore: number; decayApplied: number } {
  const now = Date.now();
  const monthsInactive = (now - attestation.lastActivityAt) / (30 * 24 * 60 * 60 * 1000);
  
  if (monthsInactive <= 0) {
    return { currentScore: attestation.trustScore, decayApplied: 0 };
  }

  // Recalculate with decay on activity components
  const decayFactor = Math.pow(1 - DECAY_RATE_MONTHLY, monthsInactive);
  const activityComponents = attestation.platformActivity + attestation.endorsements + 
    attestation.reviews + attestation.deploymentMetrics;
  const stableComponents = attestation.trustScore - activityComponents;
  
  const decayedActivity = Math.round(activityComponents * decayFactor);
  const currentScore = stableComponents + decayedActivity;
  
  return {
    currentScore,
    decayApplied: attestation.trustScore - currentScore,
  };
}
