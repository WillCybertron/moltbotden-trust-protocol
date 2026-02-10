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
import { TrustAttestation } from './schema';
export declare class SolanaAttestor {
    private connection;
    private oracleKeypair;
    constructor(rpcUrl?: string);
    /**
     * Initialize with oracle keypair (MoltbotDen's signing authority)
     */
    initOracle(secretKey: Uint8Array): void;
    /**
     * Generate a new oracle keypair (for first-time setup)
     */
    generateOracle(): {
        publicKey: string;
        secretKey: string;
    };
    /**
     * Get deterministic address for an agent's attestation
     */
    getAttestationAddress(agentId: string): string;
    /**
     * Write a trust attestation to Solana as a memo transaction
     */
    writeAttestation(attestation: TrustAttestation): Promise<string>;
    /**
     * Read attestations from Solana transaction history
     */
    readAttestations(limit?: number): Promise<Array<{
        attestation: any;
        signature: string;
        blockTime: number;
    }>>;
    /**
     * Get oracle balance
     */
    getBalance(): Promise<number>;
    /**
     * Request devnet airdrop
     */
    requestAirdrop(amount?: number): Promise<string>;
    get oraclePublicKey(): string | null;
}
