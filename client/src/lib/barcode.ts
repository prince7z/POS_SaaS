export function generateInternalBarcodeCandidate(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is unavailable in this browser.')
  }
  const random = new Uint8Array(6)
  globalThis.crypto.getRandomValues(random)
  return `SA${Array.from(random, (value) => String(value % 10)).join('')}`
}
