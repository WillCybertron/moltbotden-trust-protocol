"use strict";
/**
 * Solana Attestation Writer
 *
 * Writes trust attestations to Solana devnet as account data.
 * Uses a simple memo + account scheme for the hackathon.
 *
 * Architecture:
 * - Trust data stored as JSON memo transactions on Solana
 * - PDA-like derivation: hash(agent_id + "moltbotden-trust") for deterministic lookup
 * - Oracle (MoltbotDen) signs all attestation transactions
 * - Queryable via Solana transaction history on the oracle account
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaAttestor = void 0;
const web3_js_1 = require("@solana/web3.js");
const crypto = __importStar(require("crypto"));
// Solana Memo Program
const MEMO_PROGRAM_ID = new web3_js_1.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const DEVNET_URL = 'https://api.devnet.solana.com';
class SolanaAttestor {
    constructor(rpcUrl = DEVNET_URL) {
        this.oracleKeypair = null;
        this.connection = new web3_js_1.Connection(rpcUrl, 'confirmed');
    }
    /**
     * Initialize with oracle keypair (MoltbotDen's signing authority)
     */
    initOracle(secretKey) {
        this.oracleKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
        console.log(`Oracle initialized: ${this.oracleKeypair.publicKey.toBase58()}`);
    }
    /**
     * Generate a new oracle keypair (for first-time setup)
     */
    generateOracle() {
        const keypair = web3_js_1.Keypair.generate();
        this.oracleKeypair = keypair;
        return {
            publicKey: keypair.publicKey.toBase58(),
            secretKey: Buffer.from(keypair.secretKey).toString('base64'),
        };
    }
    /**
     * Get deterministic address for an agent's attestation
     */
    getAttestationAddress(agentId) {
        const hash = crypto.createHash('sha256')
            .update(`moltbotden-trust:${agentId}`)
            .digest();
        return hash.toString('hex').slice(0, 32);
    }
    /**
     * Write a trust attestation to Solana as a memo transaction
     */
    async writeAttestation(attestation) {
        if (!this.oracleKeypair) {
            throw new Error('Oracle not initialized. Call initOracle() or generateOracle() first.');
        }
        // Compact attestation format for memo (max ~566 bytes)
        const compactAttestation = {
            v: 1, // protocol version
            id: attestation.agentId,
            n: attestation.agentName,
            w: attestation.solanaWallet,
            ts: attestation.trustScore,
            c: {
                pa: attestation.platformActivity,
                sv: attestation.skillVerifications,
                en: attestation.endorsements,
                rv: attestation.reviews,
                dm: attestation.deploymentMetrics,
                or: attestation.onchainReputation,
                sa: attestation.securityAudit,
                aa: attestation.accountAge,
            },
            vt: attestation.verificationTier,
            at: Math.floor(attestation.attestedAt / 1000), // Unix seconds
            la: Math.floor(attestation.lastActivityAt / 1000),
            ver: attestation.version,
            dr: attestation.decayRate,
        };
        const memoData = JSON.stringify(compactAttestation);
        const memoInstruction = new web3_js_1.TransactionInstruction({
            keys: [{ pubkey: this.oracleKeypair.publicKey, isSigner: true, isWritable: false }],
            programId: MEMO_PROGRAM_ID,
            data: Buffer.from(`MDEN_TRUST:${memoData}`),
        });
        const transaction = new web3_js_1.Transaction().add(memoInstruction);
        const signature = await (0, web3_js_1.sendAndConfirmTransaction)(this.connection, transaction, [this.oracleKeypair]);
        console.log(`Trust attestation written for ${attestation.agentId}: ${signature}`);
        return signature;
    }
    /**
     * Read attestations from Solana transaction history
     */
    async readAttestations(limit = 20) {
        if (!this.oracleKeypair) {
            throw new Error('Oracle not initialized.');
        }
        const signatures = await this.connection.getSignaturesForAddress(this.oracleKeypair.publicKey, { limit });
        const attestations = [];
        for (const sig of signatures) {
            try {
                const tx = await this.connection.getTransaction(sig.signature, {
                    maxSupportedTransactionVersion: 0,
                });
                if (!tx?.meta?.logMessages)
                    continue;
                for (const log of tx.meta.logMessages) {
                    if (log.includes('MDEN_TRUST:')) {
                        const jsonStr = log.split('MDEN_TRUST:')[1];
                        if (jsonStr) {
                            try {
                                const parsed = JSON.parse(jsonStr.replace(/"/g, '"'));
                                attestations.push({
                                    attestation: parsed,
                                    signature: sig.signature,
                                    blockTime: sig.blockTime || 0,
                                });
                            }
                            catch { }
                        }
                    }
                }
            }
            catch { }
        }
        return attestations;
    }
    /**
     * Get oracle balance
     */
    async getBalance() {
        if (!this.oracleKeypair)
            throw new Error('Oracle not initialized.');
        const balance = await this.connection.getBalance(this.oracleKeypair.publicKey);
        return balance / web3_js_1.LAMPORTS_PER_SOL;
    }
    /**
     * Request devnet airdrop
     */
    async requestAirdrop(amount = 1) {
        if (!this.oracleKeypair)
            throw new Error('Oracle not initialized.');
        const sig = await this.connection.requestAirdrop(this.oracleKeypair.publicKey, amount * web3_js_1.LAMPORTS_PER_SOL);
        await this.connection.confirmTransaction(sig);
        console.log(`Airdrop of ${amount} SOL confirmed: ${sig}`);
        return sig;
    }
    get oraclePublicKey() {
        return this.oracleKeypair?.publicKey.toBase58() || null;
    }
}
exports.SolanaAttestor = SolanaAttestor;
//# sourceMappingURL=solana-attestor.js.map