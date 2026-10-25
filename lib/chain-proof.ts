import "server-only";
import {
  rpc,
  Asset,
  FeeBumpTransaction,
  Networks,
  TransactionBuilder,
  StrKey,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { ChainProof, TransferEvent } from "./receipt.ts";

/** Public Stellar RPC: read-only independent transfer evidence, no Paiflow credential. */
export async function chainProof(hash: string): Promise<ChainProof> {
  const result = await new rpc.Server("https://soroban-testnet.stellar.org", {
    timeout: 15_000,
  }).getTransaction(hash);
  const empty: ChainProof = {
    status: result.status,
    txHash: hash,
    network: "testnet",
    payer: "",
    ledger: 0,
    nativeContract: Asset.native().contractId(Networks.TESTNET),
    events: [],
  };
  if (result.status === "NOT_FOUND") return empty;
  const tx = TransactionBuilder.fromXDR(result.envelopeXdr, Networks.TESTNET);
  if (
    result.feeBump ||
    tx instanceof FeeBumpTransaction ||
    Array.from(tx.hash(), (b) => b.toString(16).padStart(2, "0")).join("") !==
      hash
  )
    return { ...empty, status: "MISMATCH" };
  const meta = result.resultMetaXdr;
  const events =
    meta.type === "v4"
      ? meta.v4.operations.flatMap((o) => o.events)
      : meta.type === "v3"
        ? meta.v3.sorobanMeta?.events || []
        : [];
  const decoded: TransferEvent[] = events.map((e, index) => ({
    id: `${hash}:${index}`,
    contract: e.contractId ? StrKey.encodeContract(e.contractId.value) : "",
    topics: e.body.v0.topics.map(scValToNative),
    amount: String(scValToNative(e.body.v0.data)),
  }));
  return { ...empty, payer: tx.source, ledger: result.ledger, events: decoded };
}
