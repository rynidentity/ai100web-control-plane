/**
 * A2A Task State Client for TON
 * Interacts with a2a_task.fc contract
 *
 * Usage:
 *   const client = new A2ATaskClient(contractAddress, provider);
 *   await client SubmitTask(taskId, queryId);
 *   await client.updateStatus(taskId, queryId, STATUS_WORKING);
 *   const task = await client.getTask(taskId);
 */

import { Address, Cell, beginCell, Contract, ContractProvider, Sender, toNano, Dictionary } from '@ton/core';

export const STATUS_SUBMITTED = 0;
export const STATUS_WORKING = 1;
export const STATUS_INPUT_REQUIRED = 2;
export const STATUS_COMPLETED = 3;
export const STATUS_FAILED = 4;
export const STATUS_CANCELED = 5;

export const OP_SUBMIT_TASK = 0x5355424d;
export const OP_UPDATE_STATUS = 0x55505444;
export const OP_SET_ARTIFACT = 0x41525446;
export const OP_GET_TASK = 0x47455454;

export const STATUS_NAMES: Record<number, string> = {
    [STATUS_SUBMITTED]: 'submitted',
    [STATUS_WORKING]: 'working',
    [STATUS_INPUT_REQUIRED]: 'input-required',
    [STATUS_COMPLETED]: 'completed',
    [STATUS_FAILED]: 'failed',
    [STATUS_CANCELED]: 'canceled',
};

export interface TaskInfo {
    status: number;
    statusName: string;
    artifactHash: string;
    createdAt: number;
    updatedAt: number;
}

export class A2ATaskClient implements Contract {
    constructor(
        readonly address: Address,
        readonly init?: { code: Cell; data: Cell }
    ) { }

    static createFromAddress(address: Address) {
        return new A2ATaskClient(address);
    }

    async sendSubmitTask(
        provider: ContractProvider,
        via: Sender,
        opts: { taskId: string; queryId: string; value?: string }
    ) {
        const taskId = BigInt(opts.taskId);
        const queryId = BigInt(opts.queryId);

        await provider.internal(via, {
            value: toNano(opts.value ?? '0.05'),
            body: beginCell()
                .store_uint(OP_SUBMIT_TASK, 32)
                .store_uint(taskId, 256)
                .store_uint(queryId, 64)
                .endCell(),
        });
    }

    async sendUpdateStatus(
        provider: ContractProvider,
        via: Sender,
        opts: { taskId: string; queryId: string; status: number; value?: string }
    ) {
        const taskId = BigInt(opts.taskId);
        const queryId = BigInt(opts.queryId);

        await provider.internal(via, {
            value: toNano(opts.value ?? '0.05'),
            body: beginCell()
                .store_uint(OP_UPDATE_STATUS, 32)
                .store_uint(taskId, 256)
                .store_uint(queryId, 64)
                .store_uint(opts.status, 8)
                .endCell(),
        });
    }

    async sendSetArtifact(
        provider: ContractProvider,
        via: Sender,
        opts: { taskId: string; queryId: string; artifactHash: string; value?: string }
    ) {
        const taskId = BigInt(opts.taskId);
        const queryId = BigInt(opts.queryId);
        const artifactHash = BigInt(opts.artifactHash);

        await provider.internal(via, {
            value: toNano(opts.value ?? '0.05'),
            body: beginCell()
                .store_uint(OP_SET_ARTIFACT, 32)
                .store_uint(taskId, 256)
                .store_uint(queryId, 64)
                .store_uint(artifactHash, 256)
                .endCell(),
        });
    }

    async getTask(provider: ContractProvider, taskId: string): Promise<TaskInfo> {
        const result = await provider.get('get_task_external', [{
            type: 'int', value: BigInt(taskId)
        }]);

        const status = result.stack.readNumber();
        const artifactHash = result.stack.readBigNumber().toString(16).padStart(64, '0'));
        const createdAt = result.stack.readNumber();
        const updatedAt = result.stack.readNumber();

        return {
            status,
            statusName: STATUS_NAMES[status] ?? 'unknown',
            artifactHash,
            createdAt,
            updatedAt,
        };
    }
}

/**
 * Helper: build a task ID from agent + nonce
 * Deterministic: hash(initiator_address + nonce)
 */
export function buildTaskId(initiatorAddress: Address, nonce: number): string {
    const cell = beginCell()
        .store_slice(initiatorAddress.asSlice())
        .store_uint(nonce, 64)
        .endCell();
    return cell.hash().toString('hex').padStart(64, '0'));
}

/**
 * Helper: compute artifact hash from result payload
 */
export function hashArtifact(payload: string): string {
    const cell = beginCell().store_string_tail(payload).endCell();
    return cell.hash().toString('hex').padStart(64, '0'));
}