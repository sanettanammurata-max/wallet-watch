import 'dotenv/config'
import { createHmac } from 'node:crypto'

async function main() {
  const baseUrl = process.env.SIMULATION_BASE_URL ?? 'http://localhost:3000'
  const webhookSecret = process.env.WEBHOOK_SIGNING_SECRET
  const targetAddress = process.env.SIMULATION_WALLET_ADDRESS

  if (!webhookSecret) throw new Error('WEBHOOK_SIGNING_SECRET is required for the simulation.')
  if (!targetAddress) throw new Error('SIMULATION_WALLET_ADDRESS is required and must already be monitored.')

  const payload = {
  blockchain: 'ETHEREUM',
  address: targetAddress,
  event: {
    network: 'ETHEREUM',
    address: targetAddress,
    transactionHash: `0x${'a'.repeat(64)}`,
    fromAddress: '0x0000000000000000000000000000000000000001',
    toAddress: targetAddress,
    amount: '0.00000000',
    tokenSymbol: 'ETH',
  },
}

const body = JSON.stringify(payload)
const signature = createHmac('sha256', webhookSecret).update(body).digest('hex')
const response = await fetch(`${baseUrl}/api/webhook/crypto`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-webhook-signature': signature,
  },
  body,
})

const result = await response.json()
console.log(JSON.stringify({ status: response.status, result }, null, 2))

if (!response.ok || !result.success) {
  process.exitCode = 1
} else if (result.duplicate) {
  console.log('The alert already existed; the webhook deduplication worked.')
  } else {
    console.log('Address-poisoning simulation accepted. Check Telegram delivery logs.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
