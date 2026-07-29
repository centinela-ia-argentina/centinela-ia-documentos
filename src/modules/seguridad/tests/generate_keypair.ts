// Herramienta de generacion de un par de claves Ed25519 para el registro
// de seguridad. Imprime tres lineas listas para pegar en .env.test.local.
// NO ejecutar salvo que se quiera emitir una clave nueva: la clave vigente
// es test-2026-07 y ya esta cargada.

import { generateKeyPairSync } from "node:crypto"

const keyId = process.argv[2] ?? `key-${new Date().toISOString().slice(0, 7)}`

const { publicKey, privateKey } = generateKeyPairSync("ed25519")

const privPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString()

const oneLine = (pem: string) => pem.trimEnd().replace(/\n/g, "\\n")

console.log(`SEGURIDAD_LEDGER_KEY_ID="${keyId}"`)
console.log(`SEGURIDAD_LEDGER_PRIVKEY_PEM="${oneLine(privPem)}"`)
console.log(`SEGURIDAD_LEDGER_PUBKEY_PEM="${oneLine(pubPem)}"`)
