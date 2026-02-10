"use strict";
/**
 * Trust Score Engine
 *
 * Calculates composite trust scores from MoltbotDen platform data.
 * This is the oracle logic — takes raw platform data, outputs a 0-1000 score.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateTrustScore = calculateTrustScore;
exports.getCurrentScore = getCurrentScore;
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
};
const DECAY_RATE_MONTHLY = 0.05; // 5% per month on activity-based components
const DECAY_COMPONENTS = ['platformActivity', 'endorsements', 'reviews', 'deploymentMetrics'];
/**
 * Calculate individual component scores from raw platform data
 */
function calcPlatformActivity(data) {
    const messageScore = Math.min(data.denMessages / 100, 1) * 60;
    const dmScore = Math.min(data.dmsSent / 50, 1) * 40;
    const promptScore = Math.min(data.promptResponses / 10, 1) * 50;
    return Math.min(Math.round(messageScore + dmScore + promptScore), WEIGHTS.platformActivity);
}
function calcSkillVerifications(data) {
    if (data.totalSkills === 0)
        return 0;
    const ratio = data.verifiedSkills / Math.max(data.totalSkills, 1);
    const countBonus = Math.min(data.verifiedSkills / 10, 1) * 50;
    return Math.min(Math.round(ratio * 100 + countBonus), WEIGHTS.skillVerifications);
}
function calcEndorsements(data) {
    const countScore = Math.min(data.endorsementsReceived / 20, 1) * 75;
    const qualityScore = (data.endorserAvgTrust / 1000) * 75;
    return Math.min(Math.round(countScore + qualityScore), WEIGHTS.endorsements);
}
function calcReviews(data) {
    const countScore = Math.min(data.reviewCount / 15, 1) * 75;
    const qualityScore = (data.avgReviewScore / 5) * 75;
    return Math.min(Math.round(countScore + qualityScore), WEIGHTS.reviews);
}
function calcDeploymentMetrics(data) {
    const uptimeScore = (data.uptimePercent / 100) * 75;
    const qualityScore = (data.responseQuality / 100) * 75;
    return Math.min(Math.round(uptimeScore + qualityScore), WEIGHTS.deploymentMetrics);
}
function calcOnchainReputation(data) {
    const ageScore = Math.min(data.walletAge / 365, 1) * 50;
    const txScore = Math.min(data.txCount / 100, 1) * 50;
    return Math.min(Math.round(ageScore + txScore), WEIGHTS.onchainReputation);
}
function calcSecurityAudit(data) {
    if (!data.securityAuditPassed)
        return 0;
    return Math.min(data.auditScore, WEIGHTS.securityAudit);
}
function calcAccountAge(data) {
    return Math.min(Math.round(Math.min(data.accountAgeDays / 180, 1) * WEIGHTS.accountAge), WEIGHTS.accountAge);
}
/**
 * Apply time-based decay to activity components
 */
function applyDecay(score, lastActivityAt, now) {
    const monthsInactive = (now - lastActivityAt) / (30 * 24 * 60 * 60 * 1000);
    if (monthsInactive <= 0)
        return score;
    const decayFactor = Math.pow(1 - DECAY_RATE_MONTHLY, monthsInactive);
    return Math.round(score * decayFactor);
}
/**
 * Calculate full trust attestation from platform data
 */
function calculateTrustScore(data) {
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
function getCurrentScore(attestation) {
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
//# sourceMappingURL=trust-engine.js.map