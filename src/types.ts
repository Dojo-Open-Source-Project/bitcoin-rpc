export type Protocol = "http" | "https";

export type MethodName =
	| "getnetworkinfo"
	| "getrawtransaction"
	| "getrawmempool"
	| "getmempoolinfo"
	| "getbestblockhash"
	| "getblock"
	| "getblockcount"
	| "getblockhash"
	| "getblockheader"
	| "getblockchaininfo"
	| "getblocktemplate"
	| "scantxoutset"
	| "sendrawtransaction"
	| "uptime";

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONType;
export type JSONType = { [member: string]: JSONValue } | Array<JSONValue>;

export type RequestOptions = {
	timeout?: number;
	abortSignal?: AbortSignal;
};

export type RPCResponse = {
	id: number | string;
	result: JSONValue;
	error: { code: number; message: string; data?: unknown } | null;
};

export type RPC2Response =
	| {
			jsonrpc: "2.0";
			id: number | string;
			result: JSONValue;
	  }
	| {
			jsonrpc: "2.0";
			id: number | string;
			error: { code: number; message: string; data?: unknown };
	  };

// Response types
export type GetBlockHeaderVerbosity = boolean;

export type GetBlockHeaderReturnType<T> = T extends false
	? string
	: T extends true
		? JSONType
		: never;

export type GetRawTransactionReturnType<T> = T extends true ? JSONType : string;

export type GetRawMempoolReturnType<T, U> = T extends true
	? JSONType
	: U extends true
		? JSONType
		: string[];

export type GetBlockVerbosity = 0 | 1;

export type GetBlockReturnType<T> = T extends 0
	? string
	: T extends 1
		? JSONType
		: never;
