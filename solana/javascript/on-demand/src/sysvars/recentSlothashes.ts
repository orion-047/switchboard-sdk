import { SPL_SYSVAR_SLOT_HASHES_ID } from "../constants.js";

import type { web3 } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import bs58 from "bs58";

/**
 * Abstraction around the SysvarS1otHashes111111111111111111111111111 sysvar
 * This sysvar is used to store the recent slot hashes
 */
export class RecentSlotHashes {
  /**
   *  Disable object instantiation.
   */
  private constructor() {}
  /**
   * Fetches the latest slot hash from the sysvar.
   * @param connection The connection to use.
   * @returns A promise that resolves to the latest slot number and hash.
   */
  public static async fetchLatest(
    connection: web3.Connection
  ): Promise<[BN, string]> {
    const defaultHash = bs58.encode(Array(32).fill(0));
    const accountInfo = await connection.getAccountInfo(
      SPL_SYSVAR_SLOT_HASHES_ID,
      {
        commitment: "finalized",
        dataSlice: { length: 40, offset: 8 },
      }
    );
    if (!accountInfo) {
      return [new BN(0), defaultHash];
    }
    const buffer = accountInfo.data;
    const slotNumber = buffer.readBigUInt64LE(0);
    const encoded = bs58.encode(Uint8Array.prototype.slice.call(buffer, 8));
    return [new BN(slotNumber.toString()), encoded];
  }

  public static async fetchLatestNSlothashes(
    connection: web3.Connection,
    n: number
  ): Promise<Array<[BN, string]>> {
    const defaultHash = bs58.encode(Array(32).fill(0));
    const accountInfo = await connection.getAccountInfo(
      SPL_SYSVAR_SLOT_HASHES_ID,
      {
        commitment: "finalized",
        dataSlice: { length: 40 * Math.floor(n), offset: 8 },
      }
    );
    if (!accountInfo) {
      return Array.from({ length: n }, () => [new BN(0), defaultHash]);
    }
    const out: Array<[BN, string]> = [];
    const buffer = accountInfo.data;
    for (let i = 0; i < n; i++) {
      const slotNumber = buffer.readBigUInt64LE(i * 40);
      const hashStart = i * 40 + 8;
      const hashEnd = hashStart + 32;
      const encoded = bs58.encode(
        Uint8Array.prototype.slice.call(buffer, hashStart, hashEnd)
      );
      out.push([new BN(slotNumber.toString()), encoded]);
    }
    return out;
  }
}
