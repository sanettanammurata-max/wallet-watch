import type { BlockchainType } from '@/lib/db/schema'

export type ChainTransaction = {
  address: string
  blockchain: BlockchainType
  txHash: string
  amount: string
  token: string
  from: string
  to: string
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  if (!response.ok) throw new Error(`Provider request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export async function fetchLatestTransaction(blockchain: BlockchainType, address: string): Promise<ChainTransaction | null> {
  if (blockchain === 'BITCOIN') {
    const rows = await getJson<Array<{ txid: string; vin?: Array<{ prevout?: { scriptpubkey_address?: string; value?: number } }>; vout?: Array<{ scriptpubkey_address?: string; value?: number }> }>>(`https://mempool.space/api/address/${encodeURIComponent(address)}/txs`)
    const tx = rows[0]
    if (!tx) return null
    const input = tx.vin?.find((item) => item.prevout?.scriptpubkey_address === address)
    const output = tx.vout?.find((item) => item.scriptpubkey_address === address)
    return { address, blockchain, txHash: tx.txid, amount: String((output?.value ?? input?.prevout?.value ?? 0) / 100_000_000), token: 'BTC', from: input?.prevout?.scriptpubkey_address ?? '', to: output?.scriptpubkey_address ?? address }
  }

  if (blockchain === 'ETHEREUM') {
    const key = process.env.ALCHEMY_API_KEY
    if (!key) throw new Error('ALCHEMY_API_KEY is not configured')
    const requestTransfers = async (direction: 'fromAddress' | 'toAddress') => getJson<{ result?: Array<{ hash: string; from: string; to: string; value: string }> }>(`https://eth-mainnet.g.alchemy.com/v2/${key}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [{ fromBlock: '0x0', toBlock: 'latest', [direction]: address, category: ['external'], maxCount: '0x1', withMetadata: false }] }) })
    const outgoing = (await requestTransfers('fromAddress')).result?.[0]
    const tx = outgoing ?? (await requestTransfers('toAddress')).result?.[0]
    return tx ? { address, blockchain, txHash: tx.hash, amount: String(tx.value || '0'), token: 'ETH', from: tx.from, to: tx.to } : null
  }

  if (blockchain === 'SOLANA') {
    const key = process.env.HELIUS_API_KEY
    if (key) {
      const rows = await getJson<Array<{ signature: string; description?: string; source?: string; type?: string }>>(`https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${key}&limit=1`)
      const tx = rows[0]
      return tx ? { address, blockchain, txHash: tx.signature, amount: '0', token: 'SOL', from: tx.source ?? '', to: address } : null
    }

    const rpc = await getJson<{ result?: Array<{ signature: string }> }>('https://api.mainnet-beta.solana.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [address, { limit: 1 }] }) })
    const tx = rpc.result?.[0]
    return tx ? { address, blockchain, txHash: tx.signature, amount: '0', token: 'SOL', from: '', to: address } : null
  }

  if (blockchain === 'STELLAR') {
    const data = await getJson<{ _embedded?: { records?: Array<{ id: string; source_account?: string; transaction?: { hash?: string }; starting_balance?: string }> } }>(`https://horizon.stellar.org/accounts/${encodeURIComponent(address)}/operations?limit=1&order=desc`)
    const tx = data._embedded?.records?.[0]
    return tx ? { address, blockchain, txHash: tx.transaction?.hash ?? tx.id, amount: tx.starting_balance ?? '0', token: 'XLM', from: tx.source_account ?? '', to: address } : null
  }

  const data = await getJson<{ result?: { transactions?: Array<{ hash: string; Account?: string; Destination?: string; Amount?: string | { value?: string; currency?: string } }> } }>(`https://data-api.xrpl.org/v1/accounts/${encodeURIComponent(address)}/transactions?limit=1`)
  const tx = data.result?.transactions?.[0]
  const amount = typeof tx?.Amount === 'string' ? String(Number(tx.Amount) / 1_000_000) : tx?.Amount?.value ?? '0'
  return tx ? { address, blockchain, txHash: tx.hash, amount, token: typeof tx.Amount === 'object' ? tx.Amount.currency ?? 'XRP' : 'XRP', from: tx.Account ?? '', to: tx.Destination ?? address } : null
}
