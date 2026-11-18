// Tipi minimi del runtime Cloudflare, per controllare il codice senza installare @cloudflare/workers-types.
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
