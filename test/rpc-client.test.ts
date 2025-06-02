import { assert, describe, it } from "vitest";
import { isRPCErrorResponse, isRPCSuccessResponse } from "../src/rpc-client";

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
