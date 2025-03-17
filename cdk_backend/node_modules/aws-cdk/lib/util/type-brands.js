"use strict";
/**
 * Type branding
 *
 * This allows marking certain types as having gone through particular operations.
 *
 * Branded types can be used anywhere the base type is expected, but the base type
 * cannot be used where a branded type is expected; the values have to go through
 * a type assertion operation to confirm their brand.
 *
 * Usage:
 *
 * ```
 * type ValidatedString = Branded<string, 'PassedMyValidation'>;
 *
 * function validate(x: string): asserts x is ValidatedString {
 *   // ... throw an error if not
 * }
 *
 * function isValid(x: string): x is ValidatedString {
 *   // ... throw an error if not
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBranded = createBranded;
/**
 * Marks a value as being branded a certain way.
 *
 * You should in general avoid calling this, and use validation or
 * asserting functions instead. However, this can be useful to produce
 * values which are branded by construction (really just an elaborate
 * way to write 'as').
 */
function createBranded(value) {
    return value;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZS1icmFuZHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ0eXBlLWJyYW5kcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQkc7O0FBaUJILHNDQUVDO0FBVkQ7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLGFBQWEsQ0FBOEIsS0FBNkI7SUFDdEYsT0FBTyxLQUFVLENBQUM7QUFDcEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVHlwZSBicmFuZGluZ1xuICpcbiAqIFRoaXMgYWxsb3dzIG1hcmtpbmcgY2VydGFpbiB0eXBlcyBhcyBoYXZpbmcgZ29uZSB0aHJvdWdoIHBhcnRpY3VsYXIgb3BlcmF0aW9ucy5cbiAqXG4gKiBCcmFuZGVkIHR5cGVzIGNhbiBiZSB1c2VkIGFueXdoZXJlIHRoZSBiYXNlIHR5cGUgaXMgZXhwZWN0ZWQsIGJ1dCB0aGUgYmFzZSB0eXBlXG4gKiBjYW5ub3QgYmUgdXNlZCB3aGVyZSBhIGJyYW5kZWQgdHlwZSBpcyBleHBlY3RlZDsgdGhlIHZhbHVlcyBoYXZlIHRvIGdvIHRocm91Z2hcbiAqIGEgdHlwZSBhc3NlcnRpb24gb3BlcmF0aW9uIHRvIGNvbmZpcm0gdGhlaXIgYnJhbmQuXG4gKlxuICogVXNhZ2U6XG4gKlxuICogYGBgXG4gKiB0eXBlIFZhbGlkYXRlZFN0cmluZyA9IEJyYW5kZWQ8c3RyaW5nLCAnUGFzc2VkTXlWYWxpZGF0aW9uJz47XG4gKlxuICogZnVuY3Rpb24gdmFsaWRhdGUoeDogc3RyaW5nKTogYXNzZXJ0cyB4IGlzIFZhbGlkYXRlZFN0cmluZyB7XG4gKiAgIC8vIC4uLiB0aHJvdyBhbiBlcnJvciBpZiBub3RcbiAqIH1cbiAqXG4gKiBmdW5jdGlvbiBpc1ZhbGlkKHg6IHN0cmluZyk6IHggaXMgVmFsaWRhdGVkU3RyaW5nIHtcbiAqICAgLy8gLi4uIHRocm93IGFuIGVycm9yIGlmIG5vdFxuICogfVxuICogYGBgXG4gKi9cblxuLy8gVGhpcyBjb25zdHJ1Y3QgcHVyZWx5IGhhcHBlbnMgYXQgdHlwZSBjaGVja2luZyB0aW1lLiBUaGVyZSBpcyBubyBydW4tdGltZSBpbXBhY3QuXG4vLyBIZW5jZSwgd2UgbmV2ZXIgZXZlbiBoYXZlIHRvIGNvbnN0cnVjdCB2YWx1ZXMgb2YgdGhpcyB0eXBlLlxuZGVjbGFyZSBjb25zdCBfX2JyYW5kOiB1bmlxdWUgc3ltYm9sO1xuXG5leHBvcnQgdHlwZSBCcmFuZDxCPiA9IHsgW19fYnJhbmRdOiBCIH07XG5leHBvcnQgdHlwZSBCcmFuZGVkPFQsIEI+ID0gVCAmIEJyYW5kPEI+O1xuXG4vKipcbiAqIE1hcmtzIGEgdmFsdWUgYXMgYmVpbmcgYnJhbmRlZCBhIGNlcnRhaW4gd2F5LlxuICpcbiAqIFlvdSBzaG91bGQgaW4gZ2VuZXJhbCBhdm9pZCBjYWxsaW5nIHRoaXMsIGFuZCB1c2UgdmFsaWRhdGlvbiBvclxuICogYXNzZXJ0aW5nIGZ1bmN0aW9ucyBpbnN0ZWFkLiBIb3dldmVyLCB0aGlzIGNhbiBiZSB1c2VmdWwgdG8gcHJvZHVjZVxuICogdmFsdWVzIHdoaWNoIGFyZSBicmFuZGVkIGJ5IGNvbnN0cnVjdGlvbiAocmVhbGx5IGp1c3QgYW4gZWxhYm9yYXRlXG4gKiB3YXkgdG8gd3JpdGUgJ2FzJykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCcmFuZGVkPEEgZXh0ZW5kcyBCcmFuZGVkPGFueSwgYW55Pj4odmFsdWU6IFR5cGVVbmRlcmx5aW5nQnJhbmQ8QT4pOiBBIHtcbiAgcmV0dXJuIHZhbHVlIGFzIEE7XG59XG5cbnR5cGUgVHlwZVVuZGVybHlpbmdCcmFuZDxBPiA9IEEgZXh0ZW5kcyBCcmFuZGVkPGluZmVyIFQsIGFueT4gPyBUIDogbmV2ZXI7XG4iXX0=