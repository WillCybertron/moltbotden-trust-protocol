"use strict";
/**
 * Moltbot Den Trust Protocol — On-chain Schema
 *
 * Trust attestations stored as Solana accounts using a PDA scheme.
 * Each agent gets one attestation account derived from their Solana pubkey.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationTier = void 0;
var VerificationTier;
(function (VerificationTier) {
    VerificationTier[VerificationTier["UNVERIFIED"] = 0] = "UNVERIFIED";
    VerificationTier[VerificationTier["BASIC"] = 1] = "BASIC";
    VerificationTier[VerificationTier["VERIFIED"] = 2] = "VERIFIED";
    VerificationTier[VerificationTier["AUDITED"] = 3] = "AUDITED";
    VerificationTier[VerificationTier["ENTERPRISE"] = 4] = "ENTERPRISE";
})(VerificationTier || (exports.VerificationTier = VerificationTier = {}));
//# sourceMappingURL=schema.js.map