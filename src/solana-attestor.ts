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

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { TrustAttestation } from './schema';
import * as crypto from 'crypto';

// Solana Memo Program
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const DEVNET_URL = 'https://api.devnet.solana.com';

export class SolanaAttestor {
  private connection: Connection;
  private oracleKeypair: Keypair | null = null;

  constructor(rpcUrl: string = DEVNET_URL) {
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Initialize with oracle keypair (MoltbotDen's signing authority)
   */
  initOracle(secretKey: Uint8Array): void {
    this.oracleKeypair = Keypair.fromSecretKey(secretKey);
    console.log(`Oracle initialized: ${this.oracleKeypair.publicKey.toBase58()}`);
  }

  /**
   * Generate a new oracle keypair (for first-time setup)
   */
  generateOracle(): { publicKey: string; secretKey: string } {
    const keypair = Keypair.generate();
    this.oracleKeypair = keypair;
    return {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: Buffer.from(keypair.secretKey).toString('base64'),
    };
  }

  /**
   * Get deterministic address for an agent's attestation
   */
  getAttestationAddress(agentId: string): string {
    const hash = crypto.createHash('sha256')
      .update(`moltbotden-trust:${agentId}`)
      .digest();
    return hash.toString('hex').slice(0, 32);
  }

  /**
   * Write a trust attestation to Solana as a memo transaction
   */
  async writeAttestation(attestation: TrustAttestation): Promise<string> {
    if (!this.oracleKeypair) {
      throw new Error('Oracle not initialized. Call initOracle() or generateOracle() first.');
    }

    // Compact attestation format for memo (max ~566 bytes)
    const compactAttestation = {
      v: 1,                                    // protocol version
      id: attestation.agentId,
      n: attestation.agentName,
      w: attestation.solanaWallet,
      ts: attestation.trustScore,
      c: {                                     // components
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
    
    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: this.oracleKeypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`MDEN_TRUST:${memoData}`),
    });

    const transaction = new Transaction().add(memoInstruction);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.oracleKeypair],
    );

    console.log(`Trust attestation written for ${attestation.agentId}: ${signature}`);
    return signature;
  }

  /**
   * Read attestations from Solana transaction history
   */
  async readAttestations(limit: number = 20): Promise<Array<{ attestation: any; signature: string; blockTime: number }>> {
    if (!this.oracleKeypair) {
      throw new Error('Oracle not initialized.');
    }

    const signatures = await this.connection.getSignaturesForAddress(
      this.oracleKeypair.publicKey,
      { limit },
    );

    const attestations = [];

    for (const sig of signatures) {
      try {
        const tx = await this.connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx?.meta?.logMessages) continue;

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
              } catch {}
            }
          }
        }
      } catch {}
    }

    return attestations;
  }

  /**
   * Get oracle balance
   */
  async getBalance(): Promise<number> {
    if (!this.oracleKeypair) throw new Error('Oracle not initialized.');
    const balance = await this.connection.getBalance(this.oracleKeypair.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Request devnet airdrop
   */
  async requestAirdrop(amount: number = 1): Promise<string> {
    if (!this.oracleKeypair) throw new Error('Oracle not initialized.');
    const sig = await this.connection.requestAirdrop(
      this.oracleKeypair.publicKey,
      amount * LAMPORTS_PER_SOL,
    );
    await this.connection.confirmTransaction(sig);
    console.log(`Airdrop of ${amount} SOL confirmed: ${sig}`);
    return sig;
  }

  get oraclePublicKey(): string | null {
    return this.oracleKeypair?.publicKey.toBase58() || null;
  }
}
