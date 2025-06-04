import { assert, describe, expect, it, vi } from "vitest";
import {
	isRPCErrorResponse,
	isRPCSuccessResponse,
	RPCClient,
} from "../src/rpc-client";
import { MockAgent, setGlobalDispatcher } from "undici";

const mockAgent = new MockAgent();
setGlobalDispatcher(mockAgent);

const mockPool = mockAgent.get("http://127.0.0.1:8332");

describe("RPCClient", () => {
	it("should initialize correctly with valid options", () => {
		const options = {
			network: "mainnet" as const,
			username: "testUser",
			password: "testPassword",
		};
		const client = new RPCClient(options);
		assert.instanceOf(client, RPCClient);
	});

	it("should throw an error for invalid network", () => {
		assert.throws(() => {
			// @ts-expect-error
			new RPCClient({ network: "invalid" });
		}, /Invalid network name/);
	});

	it("should send a 'getnetworkinfo' RPC request", async () => {
		const mockResponse = {
			id: "1",
			result: { networkinfo: "info" },
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getnetworkinfo();
		assert.deepEqual(result, { networkinfo: "info" });
	});

	it("should handle batch responses correctly", async () => {
		const mockBatchResponse = JSON.stringify([
			{ id: "1", result: "result1" },
			{ id: "2", error: { code: 123, message: "error message" } },
		]);

		mockPool
			.intercept({ method: "POST", path: "/" })
			.reply(200, mockBatchResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const batchResult = await client.batch([
			{ method: "method1", params: {} },
			{ method: "method2", params: {} },
		]);

		assert.deepEqual(batchResult, [
			{ id: "1", result: "result1" },
			{ id: "2", error: { code: 123, message: "error message" } },
		]);
	});

	it("should throw error on invalid credentials (401 response)", async () => {
		mockPool.intercept({ method: "POST", path: "/" }).reply(401, "");

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "wrongPassword",
		});

		await expect(client.getnetworkinfo()).rejects.toThrow(
			/Invalid credentials/,
		);
	});
});

describe("isRPCErrorResponse", () => {
	it("should return true for a valid RPC error response", () => {
		const validResponse = {
			id: 1,
			error: { code: 123, message: "Error occurred" },
		};
		assert.isTrue(isRPCErrorResponse(validResponse));
	});

	it("should return false if id is missing", () => {
		const invalidResponse = {
			error: { code: 123, message: "Error occurred" },
		};
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});

	it("should return false if error is missing", () => {
		const invalidResponse = { id: 1 };
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});

	it("should return false if error is null", () => {
		const invalidResponse = { id: 1, error: null };
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});

	it("should return false if error does not have a code or message", () => {
		const invalidResponse = {
			id: 1,
			error: { data: "Missing code and message" },
		};
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});

	it("should return false if payload is null", () => {
		const invalidResponse = null;
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});

	it("should return false for a non-object payload", () => {
		const invalidResponse = "invalid";
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});

	it("should return false for an empty object", () => {
		const invalidResponse = {};
		assert.isFalse(isRPCErrorResponse(invalidResponse));
	});
});

describe("isRPCSuccessResponse", () => {
	it("should return true for a valid RPC success response", () => {
		const validResponse = { id: 1, result: "Some value" };
		assert.isTrue(isRPCSuccessResponse(validResponse));
	});

	it("should return false if id is missing", () => {
		const invalidResponse = { result: "Some value" };
		assert.isFalse(isRPCSuccessResponse(invalidResponse));
	});

	it("should return false if result is missing", () => {
		const invalidResponse = { id: 1 };
		assert.isFalse(isRPCSuccessResponse(invalidResponse));
	});

	it("should return false if result is null", () => {
		const invalidResponse = { id: 1, result: null };
		assert.isFalse(isRPCSuccessResponse(invalidResponse));
	});

	it("should return false for a null payload", () => {
		const invalidResponse = null;
		assert.isFalse(isRPCSuccessResponse(invalidResponse));
	});

	it("should return false for a non-object payload", () => {
		const invalidResponse = "invalid";
		assert.isFalse(isRPCSuccessResponse(invalidResponse));
	});

	it("should return false for an empty object", () => {
		const invalidResponse = {};
		assert.isFalse(isRPCSuccessResponse(invalidResponse));
	});
});
