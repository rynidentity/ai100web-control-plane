# A2A Task State on TON

Smart contract that records A2A task lifecycle on-chain for verifiability.

## Why on-chain?

- **Agent identity** (SBT AI100WEB) and **task history** live on the same ledger
- Anyone can verify which agent started a task, when, and what the result hash was — without trusting a website
- Ties directly into x402 payments: task completion can trigger settlement

## Task lifecycle

```
submitted → working → input-required → completed
                ↘ failed
                ↘ canceled
```

## Contract: `a2a_task.fc`

Storage is a dictionary keyed by `task_id` (uint256). Each entry holds:

| Field | Type | Description |
|---|---|---|
| initiator | MsgAddress | Agent that created the task |
| status | uint8 | Current lifecycle state |
| artifact_hash | uint256 | Hash of the result payload |
| created_at | uint32 | Unix timestamp |
| updated_at | uint32 | Last state change |

### Operations

- `OP_SUBMIT_TASK` (0x5355424d) — create task, status = submitted
- `OP_UPDATE_STATUS` (0x55505444) — move task along lifecycle (initiator only)
- `OP_SET_ARTIFACT` (0x41525446) — attach result hash (completed tasks only)
- `OP_GET_TASK` (0x47455454) — query single task
- Getter `get_task_external(task_id)` — read-only external call

### Guarantees

- Only the initiator can update or cancel
- `completed` and `canceled` are terminal — no further transitions
- Artifact hash can only be set after completion
- Every state change emits a response message so the calling agent gets confirmation

## Client: `a2a_task.ts`

TypeScript wrapper using `@ton/core`:

```typescript
import { A2ATaskClient, STATUS_WORKING, buildTaskId, hashArtifact } from './a2a_task';

const client = A2ATaskClient.createFromAddress(contractAddress);

// Grok Bot submits a task to trader agent
const taskId = buildTaskId(grokBotAddress, Date.now());
await client.sendSubmitTask(provider, grokBotWallet, { taskId, queryId: '1' });

// Trader agent moves it to working
await client.sendUpdateStatus(provider, traderWallet, {
    taskId, queryId: '2', status: STATUS_WORKING
});

// On completion, store the artifact hash
const artifactHash = hashArtifact(JSON.stringify(tradeResult));
await client.sendUpdateStatus(provider, traderWallet, {
    taskId, queryId: '3', status: 3 /* completed */
});
await client.sendSetArtifact(provider, traderWallet, { taskId, queryId: '4', artifactHash });

// Anyone can verify
const task = await client.getTask(provider, taskId);
console.log(task.statusName, task.artifactHash);
```

## Next steps

1. Compile with `func` and deploy to testnet
2. Wire Grok Bot to call `sendSubmitTask` on outbound A2A delegation
3. Have each sub-agent update status as it progresses
4. Link artifact hash to x402 settlement trigger
5. Measure gas per op on testnet before mainnet

## Gas estimate (testnet, to verify)

Rough: submit ~0.03-0.05 TON, status update ~0.02-0.04 TON, set artifact ~0.02-0.04 TON. Actual numbers depend on dict size and message size — run the E2E suite to confirm.

## Links

- A2A spec: https://a2a-protocol.org/latest/specification/
- TON docs: https://docs.ton.org
- Parent issue: cross-agent task delegation via A2A