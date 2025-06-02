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

export type RPCSuccessResponse = {
	id: number | string;
	result: JSONValue;
};

export type RPCErrorResponse = {
	id: number | string;
	error: { code: number; message: string; data?: unknown };
};

// Response types

export type GetBlockHeaderReturnType<T> = T extends false ? string : JSONType;

export type GetRawTransactionReturnType<T> = T extends true ? JSONType : string;

export type GetRawMempoolReturnType<T, U> = T extends true
	? JSONType
	: U extends true
		? JSONType
		: string[];

export type GetBlockVerbosity = 0 | 1 | 2;

export type GetBlockReturnType<T extends GetBlockVerbosity> = T extends 0
	? string
	: JSONType;

export type GetTxOutReturnType = {
	bestblock: string;
	confirmations: number;
	value: number;
	scriptPubKey: {
		asm: string;
		desc: string;
		hex: string;
		address: string;
		type: string;
	};
	coinbase: boolean;
};
