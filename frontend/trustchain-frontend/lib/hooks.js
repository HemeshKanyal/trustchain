"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { trustChain, coldChainMonitor, DEPLOYED } from "./config";
import { api } from "./api";
import { authedFetch } from "./session";

const LIVE = { refetchInterval: 8000 };

function useRead(key, fn, opts = {}) {
  const client = usePublicClient();
  return useQuery({ queryKey: ["chain", ...key], queryFn: () => fn(client), enabled: DEPLOYED && (opts.enabled ?? true), ...opts });
}

const read = (client, contract, functionName, args = []) => client.readContract({ ...contract, functionName, args });

export function useParticipant(address) {
  return useRead(["participant", address], (c) => read(c, trustChain, "getParticipant", [address]), { enabled: Boolean(address) });
}

/** Connected account + its on-chain participant record. */
export function useMe() {
  const { address, isConnected } = useAccount();
  const q = useRead(
    ["me", address],
    async (c) => {
      const [participant, owner, application] = await Promise.all([
        read(c, trustChain, "getParticipant", [address]),
        read(c, trustChain, "owner"),
        read(c, trustChain, "getApplication", [address]),
      ]);
      return { participant, owner, application };
    },
    { enabled: Boolean(address), refetchInterval: 8000 },
  );
  const p = q.data?.participant;
  const isOwner = Boolean(address && q.data && q.data.owner.toLowerCase() === address.toLowerCase());
  return {
    address,
    isConnected,
    loading: q.isLoading,
    participant: p,
    role: p ? Number(p.role) : 0,
    active: Boolean(p?.active),
    isOwner,
    owner: q.data?.owner,
    isAdmin: isOwner || (Number(p?.role) === 1 && p?.active),
    application: q.data?.application && Number(q.data.application.role) ? q.data.application : null,
  };
}

export function useParticipants() {
  return useRead(["participants"], async (c) => {
    const addrs = await read(c, trustChain, "getParticipants");
    const ps = await Promise.all(addrs.map((a) => read(c, trustChain, "getParticipant", [a])));
    return addrs.map((address, i) => ({ address, ...ps[i], role: Number(ps[i].role) }));
  });
}

export function useApplications() {
  return useRead(["applications"], async (c) => {
    const addrs = await read(c, trustChain, "getApplicants");
    const apps = await Promise.all(addrs.map((a) => read(c, trustChain, "getApplication", [a])));
    return addrs.map((address, i) => ({ address, ...apps[i], role: Number(apps[i].role) })).filter((a) => a.role !== 0);
  }, LIVE);
}

export async function fetchBatch(c, id) {
  const b = await read(c, trustChain, "getBatch", [BigInt(id)]);
  return { id: Number(id), ...b, status: Number(b.status) };
}

export function useBatch(id) {
  return useRead(["batch", String(id)], (c) => fetchBatch(c, id), { enabled: id != null });
}

export function useAllBatches() {
  return useRead(["batches"], async (c) => {
    const n = Number(await read(c, trustChain, "batchCount"));
    return Promise.all(Array.from({ length: n }, (_, i) => fetchBatch(c, i + 1)));
  }, LIVE);
}

async function fetchShipment(c, id) {
  const s = await read(c, trustChain, "getShipment", [BigInt(id)]);
  return { id: Number(id), ...s, status: Number(s.status), batchId: Number(s.batchId), quantity: Number(s.quantity) };
}

export function useShipment(id) {
  return useRead(["shipment", String(id)], (c) => fetchShipment(c, id), { enabled: id != null, ...LIVE });
}

/** Shipments where `address` is sender or recipient, newest first, with their batch attached. */
export function useShipmentsOf(address) {
  return useRead(["shipmentsOf", address], async (c) => {
    const ids = await read(c, trustChain, "getShipmentsOf", [address]);
    const list = await Promise.all([...ids].reverse().map((id) => fetchShipment(c, id)));
    const batchIds = [...new Set(list.map((s) => s.batchId))];
    const batches = Object.fromEntries(await Promise.all(batchIds.map(async (b) => [b, await fetchBatch(c, b)])));
    return list.map((s) => ({ ...s, batch: batches[s.batchId] }));
  }, { enabled: Boolean(address), ...LIVE });
}

/** Batches the account holds stock of (manufactured or received), with balances. */
export function useInventory(address) {
  return useRead(["inventory", address], async (c) => {
    const [made, shipIds] = await Promise.all([
      read(c, trustChain, "getBatchesByManufacturer", [address]),
      read(c, trustChain, "getShipmentsOf", [address]),
    ]);
    const ships = await Promise.all(shipIds.map((id) => fetchShipment(c, id)));
    const ids = [...new Set([...made.map(Number), ...ships.map((s) => s.batchId)])].sort((a, b) => b - a);
    const rows = await Promise.all(
      ids.map(async (id) => {
        const [batch, bal] = await Promise.all([fetchBatch(c, id), read(c, trustChain, "balanceOf", [BigInt(id), address])]);
        return { ...batch, balance: Number(bal), mine: batch.manufacturer.toLowerCase() === address.toLowerCase() };
      }),
    );
    return rows;
  }, { enabled: Boolean(address), ...LIVE });
}

async function fetchPrescription(c, id) {
  const [p, usable] = await Promise.all([
    read(c, trustChain, "getPrescription", [BigInt(id)]),
    read(c, trustChain, "isPrescriptionUsable", [BigInt(id)]),
  ]);
  return { id: Number(id), ...p, allowance: Number(p.allowance), dispensed: Number(p.dispensed), usable };
}

export function usePrescription(id) {
  return useRead(["rx", String(id)], (c) => fetchPrescription(c, id), { enabled: Boolean(id) && Number(id) > 0 });
}

export function usePrescriptionsOf(address, by = "patient") {
  const fn = by === "doctor" ? "getPrescriptionsOfDoctor" : "getPrescriptionsOfPatient";
  return useRead(["rxOf", by, address], async (c) => {
    const ids = await read(c, trustChain, fn, [address]);
    return Promise.all([...ids].reverse().map((id) => fetchPrescription(c, id)));
  }, { enabled: Boolean(address) });
}

export function useVerify(codeHash) {
  return useRead(["verify", codeHash], (c) => read(c, trustChain, "verify", [codeHash]), { enabled: Boolean(codeHash) });
}

export function useDevices() {
  return useRead(["devices"], async (c) => {
    const addrs = await read(c, coldChainMonitor, "getDevices");
    const ds = await Promise.all(addrs.map((a) => read(c, coldChainMonitor, "getDevice", [a])));
    return addrs.map((address, i) => ({ address, ...ds[i] }));
  });
}

export function useTelemetrySummary(shipmentId) {
  return useRead(["telemetry", String(shipmentId)], (c) => read(c, coldChainMonitor, "getTelemetry", [BigInt(shipmentId)]), {
    enabled: shipmentId != null,
    ...LIVE,
  });
}

export function usePaused() {
  return useRead(["paused"], (c) => read(c, trustChain, "paused"), LIVE);
}

// ---- backend (indexer) ----
export function useApi(path, opts = {}) {
  return useQuery({ queryKey: ["api", path], queryFn: () => api(path), enabled: Boolean(path) && (opts.enabled ?? true), retry: 1, ...opts });
}

/** lowercase address -> participant name */
export function useNames() {
  const { data } = useParticipants();
  const map = {};
  for (const p of data ?? []) map[p.address.toLowerCase()] = p.name;
  return (a) => (a ? map[a.toLowerCase()] : undefined);
}

/** Backend call with the signed-in session (private data). */
export function useAuthedApi(path, address, opts = {}) {
  return useQuery({
    queryKey: ["api-auth", path, address],
    queryFn: () => authedFetch(path, address),
    enabled: Boolean(path && address) && (opts.enabled ?? true),
    retry: 1,
    ...opts,
  });
}

export function useBatchAffected(id) {
  return useApi(id ? `/api/batches/${id}/affected` : null, { refetchInterval: 15000 });
}
