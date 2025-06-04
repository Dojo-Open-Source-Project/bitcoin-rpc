import { assert, describe, expect, it, vi, beforeEach } from "vitest";
import {
	isRPCErrorResponse,
	isRPCSuccessResponse,
	RPCClient,
} from "../src/rpc-client";
import { MockAgent, setGlobalDispatcher } from "undici";
import * as fs from "node:fs";

const mockAgent = new MockAgent();
setGlobalDispatcher(mockAgent);
mockAgent.disableNetConnect();

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

	it("should throw error on non-200 status code (500 response)", async () => {
		const errorResponse = { error: "Internal server error" };
		mockPool.intercept({ method: "POST", path: "/" }).reply(500, errorResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		await expect(client.getnetworkinfo()).rejects.toThrow();
	});

	it("should throw error on RPC error response", async () => {
		const errorResponse = {
			id: "1",
			error: { code: -32601, message: "Method not found" },
		};
		mockPool.intercept({ method: "POST", path: "/" }).reply(200, errorResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		await expect(client.getnetworkinfo()).rejects.toThrow(
			/Code: -32601, Method not found/,
		);
	});

	it("should throw error on invalid RPC response", async () => {
		const invalidResponse = { invalid: "response" };
		mockPool
			.intercept({ method: "POST", path: "/" })
			.reply(200, invalidResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		await expect(client.getnetworkinfo()).rejects.toThrow(
			/Received invalid RPC response/,
		);
	});

	it("should throw error on non-200 status code in batch request", async () => {
		const errorResponse = { error: "Internal server error" };
		mockPool.intercept({ method: "POST", path: "/" }).reply(500, errorResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		await expect(
			client.batch([
				{ method: "method1", params: {} },
				{ method: "method2", params: {} },
			]),
		).rejects.toThrow();
	});

	it("should throw error on invalid batch response", async () => {
		const invalidResponse = { invalid: "response" }; // Not an array
		mockPool
			.intercept({ method: "POST", path: "/" })
			.reply(200, invalidResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		await expect(
			client.batch([
				{ method: "method1", params: {} },
				{ method: "method2", params: {} },
			]),
		).rejects.toThrow(/Received invalid RPC response/);
	});

	it("should test sendrawtransaction method", async () => {
		const mockResponse = {
			id: "1",
			result: "transaction_hash",
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.sendrawtransaction({
			hexstring: "01020304",
		});
		assert.equal(result, "transaction_hash");
	});

	it("should test getuptime method", async () => {
		const mockResponse = {
			id: "1",
			result: "3600",
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getuptime();
		assert.equal(result, "3600");
	});

	it("should test gettxout method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				bestblock:
					"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
				confirmations: 1,
				value: 0.00001,
				scriptPubKey: {
					asm: "OP_DUP OP_HASH160 hash OP_EQUALVERIFY OP_CHECKSIG",
					hex: "76a914hash88ac",
					type: "pubkeyhash",
					address: "address",
				},
				coinbase: false,
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.gettxout({
			txid: "txid",
			n: 0,
			include_mempool: true,
		});

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test scantxoutset method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				success: true,
				txouts: 100,
				height: 680000,
				bestblock:
					"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
				unspents: [],
				total_amount: 0,
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.scantxoutset({
			action: "start",
			scanobjects: ["addr(address)"],
		});

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test getblockheader method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				hash: "00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
				confirmations: 1,
				height: 680000,
				version: 536870912,
				versionHex: "20000000",
				merkleroot: "merkleroot",
				time: 1620000000,
				mediantime: 1619999000,
				nonce: 123456789,
				bits: "1a01f56e",
				difficulty: 21448277761059.71,
				chainwork: "chainwork",
				nTx: 1000,
				previousblockhash: "previousblockhash",
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getblockheader({
			blockhash:
				"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
			verbose: true,
		});

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test getrawtransaction method", async () => {
		const mockResponse = {
			id: "1",
			result: "01000000000000000000",
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getrawtransaction({
			txid: "txid",
			verbose: false,
		});

		assert.equal(result, "01000000000000000000");
	});

	it("should test getblocktemplate method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				version: 536870912,
				rules: ["segwit"],
				previousblockhash:
					"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
				transactions: [],
				coinbaseaux: {
					flags: "",
				},
				coinbasevalue: 625000000,
				longpollid: "longpollid",
				target: "target",
				mintime: 1620000000,
				mutable: ["time", "transactions", "prevblock"],
				noncerange: "00000000ffffffff",
				sigoplimit: 80000,
				sizelimit: 4000000,
				weightlimit: 4000000,
				curtime: 1620000100,
				bits: "1a01f56e",
				height: 680001,
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getblocktemplate({
			rules: ["segwit"],
			capabilities: ["coinbasetxn", "workid", "coinbase/append"],
		});

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test getblockchaininfo method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				chain: "main",
				blocks: 680000,
				headers: 680000,
				bestblockhash:
					"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
				difficulty: 21448277761059.71,
				mediantime: 1620000000,
				verificationprogress: 0.9999,
				initialblockdownload: false,
				chainwork: "chainwork",
				size_on_disk: 380000000000,
				pruned: false,
				softforks: {},
				warnings: "",
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getblockchaininfo();

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test getblock method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				hash: "00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
				confirmations: 1,
				size: 1000,
				strippedsize: 800,
				weight: 3600,
				height: 680000,
				version: 536870912,
				versionHex: "20000000",
				merkleroot: "merkleroot",
				tx: ["tx1", "tx2"],
				time: 1620000000,
				mediantime: 1619999000,
				nonce: 123456789,
				bits: "1a01f56e",
				difficulty: 21448277761059.71,
				chainwork: "chainwork",
				nTx: 2,
				previousblockhash: "previousblockhash",
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getblock({
			blockhash:
				"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
			verbosity: 1,
		});

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test getblockhash method", async () => {
		const mockResponse = {
			id: "1",
			result:
				"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getblockhash({ height: 680000 });

		assert.equal(
			result,
			"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
		);
	});

	it("should test getmempoolinfo method", async () => {
		const mockResponse = {
			id: "1",
			result: {
				loaded: true,
				size: 1000,
				bytes: 2000000,
				usage: 3000000,
				maxmempool: 300000000,
				mempoolminfee: 0.00001,
				minrelaytxfee: 0.00001,
			},
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getmempoolinfo();

		assert.deepEqual(result, mockResponse.result);
	});

	it("should test getbestblockhash method", async () => {
		const mockResponse = {
			id: "1",
			result:
				"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getbestblockhash();

		assert.equal(
			result,
			"00000000000000000007e2d2d4b1072a4f3a25a273d2b7e200f2f8a73b187143",
		);
	});

	it("should test getblockcount method", async () => {
		const mockResponse = {
			id: "1",
			result: 680000,
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getblockcount();

		assert.equal(result, 680000);
	});

	it("should test getrawmempool method", async () => {
		const mockResponse = {
			id: "1",
			result: ["tx1", "tx2", "tx3"],
		};

		mockPool.intercept({ method: "POST", path: "/" }).reply(200, mockResponse);

		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		const result = await client.getrawmempool({ verbose: false });

		assert.deepEqual(result, ["tx1", "tx2", "tx3"]);
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

// Mock the fs module
vi.mock("node:fs", () => {
	return {
		readFileSync: vi.fn(),
	};
});

describe("getCredentials", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("should initialize with username and password", () => {
		const client = new RPCClient({
			network: "mainnet",
			username: "testUser",
			password: "testPassword",
		});

		assert.instanceOf(client, RPCClient);
	});

	it("should throw error when username or password is missing", () => {
		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				// Missing username and password
			});
		}, /Unathenticated RPC communication is not supported/);

		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				username: "testUser",
				// Missing password
			});
		}, /Unathenticated RPC communication is not supported/);

		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				// Missing username
				password: "testPassword",
			});
		}, /Unathenticated RPC communication is not supported/);
	});

	it("should read credentials from cookie file", () => {
		vi.mocked(fs.readFileSync).mockReturnValue("testUser:testPassword");

		const client = new RPCClient({
			network: "mainnet",
			cookie: "/path/to/cookie",
		});

		assert.instanceOf(client, RPCClient);
		expect(fs.readFileSync).toHaveBeenCalledWith("/path/to/cookie", "utf8");
	});

	it("should throw error when cookie file is invalid", () => {
		vi.mocked(fs.readFileSync).mockReturnValue("invalid-cookie-format");

		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				cookie: "/path/to/cookie",
			});
		}, /Cookie file is invalid/);
	});

	it("should throw error when cookie file is not found", () => {
		const error = new Error("File not found");
		// @ts-ignore
		error.code = "ENOENT";
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			throw error;
		});

		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				cookie: "/path/to/cookie",
			});
		}, /File not found: \/path\/to\/cookie/);
	});

	it("should throw error when cookie file access is denied", () => {
		const error = new Error("Permission denied");
		// @ts-ignore
		error.code = "EACCES";
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			throw error;
		});

		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				cookie: "/path/to/cookie",
			});
		}, /Permission denied: \/path\/to\/cookie/);
	});

	it("should throw original error for other file system errors", () => {
		const error = new Error("Some other error");
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			throw error;
		});

		assert.throws(() => {
			new RPCClient({
				network: "mainnet",
				cookie: "/path/to/cookie",
			});
		}, /Some other error/);
	});

	it("should refresh cookie credentials when using cookie authentication", async () => {
		// Setup mock to return different values on each call
		const firstCookie = "testUser:testPassword";
		const secondCookie = "newUser:newPassword";

		vi.mocked(fs.readFileSync)
			.mockReturnValueOnce(firstCookie) // First call during initialization
			.mockReturnValue(secondCookie); // Second call during refresh

		const mockResponse = {
			id: "1",
			result: { networkinfo: "info" },
		};

		// Create client with cookie authentication
		const client = new RPCClient({
			network: "mainnet",
			cookie: "/path/to/cookie",
		});

		// First request should fail with 401, triggering a cookie refresh
		mockPool
			.intercept({
				method: "POST",
				path: "/",
				headers: {
					Authorization: `Basic ${Buffer.from(firstCookie).toString("base64")}`,
				},
			})
			.reply(401, "");

		// After refresh, the second request should succeed
		mockPool
			.intercept({
				method: "POST",
				path: "/",
				headers: {
					Authorization: `Basic ${Buffer.from(secondCookie).toString("base64")}`,
				},
			})
			.reply(200, mockResponse);

		// This should trigger a 401, then a refresh, then a successful request
		const result = await client.getnetworkinfo();

		assert.deepEqual(result, { networkinfo: "info" });

		// Verify readFileSync was called twice
		expect(fs.readFileSync).toHaveBeenCalledTimes(2);
		expect(fs.readFileSync).toHaveBeenNthCalledWith(
			1,
			"/path/to/cookie",
			"utf8",
		);
		expect(fs.readFileSync).toHaveBeenNthCalledWith(
			2,
			"/path/to/cookie",
			"utf8",
		);
	});
});
