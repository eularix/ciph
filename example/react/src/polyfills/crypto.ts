// Polyfill node:crypto untuk browser — redirect ke Web Crypto API
export const webcrypto = globalThis.crypto
export default { webcrypto: globalThis.crypto }