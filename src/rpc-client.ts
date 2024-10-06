import { readFileSync } from "node:fs";
import { Agent, fetch } from "undici";

import type {
	GetBlockHeaderReturnType,
	GetBlockReturnType,
	GetBlockVerbosity,
	GetRawMempoolReturnType,
	GetRawTransactionReturnType,
	JSONType,
	JSONValue,
	MethodName,
	Protocol,
	RPC2Response,
	RPCResponse,
	RequestOptions,
} from "./types";

/**
 * List of networks and their default port mapping.
 */

const networks = {
	mainnet: 8332,
	regtest: 18332,
	signet: 38332,
	testnet: 18332,
};

export type RPCOptions = {
	network?: keyof typeof networks;
	host?: string;
	port?: number;
	protocol?: Protocol;
	username?: string;
	password?: string;
	cookie?: string;
	timeout?: number;
};

const isRPCResponse = (payload: unknown): payload is RPCResponse => {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"id" in payload &&
		"result" in payload &&
		"error" in payload
	);
};

const isRPC2Response = (payload: unknown): payload is RPC2Response => {
	return (
		typeof payload === "object" &&
		payload !== null &&
		"jsonrpc" in payload &&
		payload.jsonrpc === "2.0"
	);
};

export class RPCClient {
	private readonly username: string;
	private readonly password: string;
	private readonly host: string;
	private readonly port: number;
	private readonly protocol: Protocol;
	private readonly timeout: number;

	constructor(options: RPCOptions) {
		this.validateNetwork(options.network);

		const credentials = this.getCredentials(options);
		this.username = credentials.username;
		this.password = credentials.password;

		const defaults = this.getDefaults(options);
		this.host = defaults.host;
		this.port = defaults.port;
		this.protocol = defaults.protocol;
		this.timeout = defaults.timeout;
	}

	private validateNetwork(network?: keyof typeof networks) {
		if (network && !networks[network]) {
			throw new Error(`Invalid network name ${network}`);
		}
	}

	private getCredentials(options: RPCOptions): {
		username: string;
		password: string;
	} {
		let { username, password, cookie } = options;
		if (cookie) {
			[username, password] = this.handleCookie(cookie);
		}
		if (!username || !password) {
			throw new Error(
				"Unathenticated RPC communication is not supported. Provide valid username and password",
			);
		}
		return { username, password };
	}

	private getDefaults(options: RPCOptions): {
		host: string;
		port: number;
		protocol: Protocol;
		timeout: number;
	} {
		return {
			host: options.host || "127.0.0.1",
			port: options.port || networks[options.network || "mainnet"],
			protocol: options.protocol || "http",
			timeout: options.timeout || 30000,
		};
	}

	private handleCookie(cookie: string): [string, string] {
		try {
			const tokens = readFileSync(cookie, "utf8").split(":");
			if (tokens.length !== 2) {
				throw new Error("Cookie file is invalid");
			}
			return [tokens[0].trim(), tokens[1].trim()];
		} catch (error_) {
			const error = error_ as NodeJS.ErrnoException;
			switch (error.code) {
				case "ENOENT":
					throw new Error(`File not found: ${cookie}`);
				case "EACCES":
					throw new Error(`Permission denied: ${cookie}`);
				default:
					throw error;
			}
		}
	}

	// biome-ignore  lint/suspicious/noExplicitAny: no strict type checking required
	private createRequest = (reqBody: any, options?: RequestOptions) => {
		const url = new URL(`${this.protocol}://${this.host}:${this.port}/`);

		const body = JSON.stringify(reqBody);

		return fetch(url, {
			method: "POST",
			keepalive: true,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}`,
			},
			signal: options?.abortSignal,
			body,
			dispatcher: new Agent({
				bodyTimeout: options?.timeout || this.timeout,
			}),
		});
	};

	private makeRequest = async <T extends JSONValue>(
		{
			method,
			parameters = [],
			suffix,
		}: {
			method: MethodName;
			parameters?: Partial<JSONType>;
			suffix?: string;
		},
		options?: RequestOptions,
	): Promise<T> => {
		const reqBody = {
			jsonrpc: "2.0",
			id: `${Date.now()}${suffix == null ? "" : `-${suffix}`}`,
			method,
			params: parameters,
		};

		const request = this.createRequest(reqBody, options);

		const response = await request;

		if (!response.ok) {
			throw new Error(`Received invalid status code: ${response.status}`);
		}

		const data = await response.json();

		if (isRPC2Response(data)) {
			if ("error" in data) {
				throw new Error(`Code: ${data.error.code}, ${data.error.message}`);
			}
			return data.result as T;
		}

		if (isRPCResponse(data)) {
			if (data.error !== null) {
				throw new Error(`Code: ${data.error.code}, ${data.error.message}`);
			}
			return data.result as T;
		}

		throw new Error(`Received invalid RPC response: ${JSON.stringify(data)}`);
	};

	public batch = async (
		rpcRequests: Array<{
			method: string;
			params: JSONType;
			id?: string | number;
		}>,
		options?: RequestOptions,
	): Promise<RPCResponse[] | RPC2Response[]> => {
		const now = Date.now();
		const reqBody = rpcRequests.map(({ method, params, id }, index) => {
			id = id || `${now}-${index}`;

			return {
				jsonrpc: "2.0",
				id,
				method,
				params,
			};
		});

		const request = this.createRequest(reqBody, options);

		const response = await request;

		if (!response.ok) {
			throw new Error(`Received invalid status code: ${response.status}`);
		}

		const data = await response.json();

		if (Array.isArray(data)) {
			if (data.every(isRPC2Response)) {
				return data;
			}

			if (data.every(isRPCResponse)) {
				return data;
			}
		}

		throw new Error(`Received invalid RPC response: ${JSON.stringify(data)}`);
	};

	public getnetworkinfo = (options?: RequestOptions): Promise<JSONType> => {
		return this.makeRequest({ method: "getnetworkinfo" }, options);
	};

	public getmempoolinfo = (options?: RequestOptions): Promise<JSONType> => {
		return this.makeRequest({ method: "getmempoolinfo" }, options);
	};

	public getbestblockhash = (options?: RequestOptions): Promise<string> => {
		return this.makeRequest({ method: "getbestblockhash" }, options);
	};

	public getblockcount = (options?: RequestOptions): Promise<number> => {
		return this.makeRequest({ method: "getblockcount" }, options);
	};

	public getblockheader = <T extends boolean>(
		{
			blockhash,
			verbose,
		}: {
			blockhash: string;
			verbose?: T;
		},
		options?: RequestOptions,
	): Promise<GetBlockHeaderReturnType<T>> => {
		return this.makeRequest(
			{ method: "getblockheader", parameters: { blockhash, verbose } },
			options,
		);
	};

	public getrawtransaction = <T extends boolean>(
		{
			txid,
			verbose,
			blockhash,
		}: { txid: string; verbose?: T; blockhash?: string },
		options?: RequestOptions,
	): Promise<GetRawTransactionReturnType<T>> => {
		return this.makeRequest(
			{ method: "getrawtransaction", parameters: { txid, verbose, blockhash } },
			options,
		);
	};

	public getrawmempool = <T extends boolean, U extends boolean>(
		{ verbose, mempool_sequence }: { verbose?: T; mempool_sequence?: U },
		options?: RequestOptions,
	): Promise<GetRawMempoolReturnType<T, U>> => {
		return this.makeRequest(
			{ method: "getrawmempool", parameters: { verbose, mempool_sequence } },
			options,
		);
	};

	public getblock = <T extends GetBlockVerbosity>(
		{ blockhash, verbosity }: { blockhash: string; verbosity: T },
		options?: RequestOptions,
	): Promise<GetBlockReturnType<T>> => {
		return this.makeRequest(
			{ method: "getblock", parameters: { blockhash, verbosity } },
			options,
		);
	};

	public getblockhash = (
		{ height }: { height: number },
		options?: RequestOptions,
	): Promise<string> => {
		return this.makeRequest(
			{ method: "getblockhash", parameters: { height } },
			options,
		);
	};

	public getblocktemplate = (
		obj: JSONType,
		options?: RequestOptions,
	): Promise<JSONType> => {
		return this.makeRequest(
			{ method: "getblocktemplate", parameters: obj },
			options,
		);
	};

	public getblockchaininfo = (options?: RequestOptions): Promise<JSONType> => {
		return this.makeRequest({ method: "getblockchaininfo" }, options);
	};

	public scantxoutset = (
		{
			action,
			scanobjects,
		}: {
			action: "start" | "abort" | "status";
			scanobjects:
				| string[]
				| { desc: string; range?: number | [number, number] }[];
		},
		options?: RequestOptions,
	): Promise<JSONType> => {
		return this.makeRequest(
			{ method: "scantxoutset", parameters: { action, scanobjects } },
			options,
		);
	};

	public sendrawtransaction = (
		{
			hexstring,
			maxfeerate,
		}: { hexstring: string; maxfeerate?: number | string },
		options?: RequestOptions,
	): Promise<string> => {
		return this.makeRequest(
			{ method: "sendrawtransaction", parameters: { hexstring, maxfeerate } },
			options,
		);
	};

	public getuptime = (options?: RequestOptions): Promise<string> => {
		return this.makeRequest({ method: "uptime" }, options);
	};
}
