/**
 * TransactionManager for PUDA — wraps the app's db module.
 */
import type { TransactionHandle, TransactionManager } from "@puda/workflow-engine";
import type { PoolClient } from "pg";
import { getClient as dbGetClient } from "../db";

export class PudaTransactionManager implements TransactionManager {
  async runInTransaction<T>(
    fn: (txn: TransactionHandle) => Promise<T>,
    existingTxn?: TransactionHandle
  ): Promise<T> {
    // Join existing transaction — caller owns BEGIN/COMMIT/ROLLBACK
    if (existingTxn) {
      return fn(existingTxn);
    }

    // Own the transaction lifecycle
    const client: PoolClient = await dbGetClient();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '5s'");

      const txn: TransactionHandle = { client };
      const result = await fn(txn);

      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}
