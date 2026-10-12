import { boolean, decimal, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const securityUser = pgTable('security_user', {
  id: text('id').primaryKey(),
  telegramChatId: text('telegram_chat_id').notNull().unique(),
  isPremium: boolean('is_premium').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const monitoredWallet = pgTable('monitored_wallet', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  blockchain: text('blockchain').notNull(),
  walletAddress: text('wallet_address').notNull(),
  webhookId: text('webhook_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ownerAddressUnique: unique().on(table.userId, table.blockchain, table.walletAddress),
}))

export type BlockchainType = 'BITCOIN' | 'ETHEREUM' | 'SOLANA' | 'STELLAR' | 'XRP'
export type MonitoredWallet = typeof monitoredWallet.$inferSelect
export const paymentIntent = pgTable('payment_intent', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  nonce: text('nonce').notNull().unique(),
  network: text('network').notNull(),
  amount: decimal('amount', { precision: 20, scale: 7 }).notNull(),
  assetCode: text('asset_code').notNull(),
  assetIssuer: text('asset_issuer').notNull(),
  receiver: text('receiver').notNull(),
  status: text('status').notNull().default('created'),
  transactionHash: text('transaction_hash').unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const securityAlert = pgTable('security_alert', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  blockchain: text('blockchain').notNull(),
  walletAddress: text('wallet_address').notNull(),
  alertType: text('alert_type').notNull(),
  amount: decimal('amount', { precision: 28, scale: 8 }).notNull(),
  tokenSymbol: text('token_symbol').notNull(),
  txHash: text('tx_hash').notNull().unique(),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type SecurityUser = typeof securityUser.$inferSelect
export type SecurityAlert = typeof securityAlert.$inferSelect

export const blockchainTypes = ['BITCOIN', 'ETHEREUM', 'SOLANA', 'STELLAR', 'XRP'] as const
export const blockchainLabels: Record<BlockchainType, string> = {
  BITCOIN: 'Bitcoin',
  ETHEREUM: 'Ethereum',
  SOLANA: 'Solana',
  STELLAR: 'Stellar',
  XRP: 'XRP Ledger',
}

export function isBlockchainType(value: string): value is BlockchainType {
  return blockchainTypes.includes(value as BlockchainType)
}

export const addressValidators: Record<BlockchainType, RegExp> = {
  BITCOIN: /^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-zA-HJ-NP-Z0-9]{25,65}$/,
  ETHEREUM: /^0x[a-fA-F0-9]{40}$/,
  SOLANA: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  STELLAR: /^G[A-Z2-7]{55}$/,
  XRP: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
}

export function isValidWalletAddress(blockchain: BlockchainType, address: string) {
  return addressValidators[blockchain].test(address)
}

export function getExplorerUrl(blockchain: string, hash: string) {
  const explorers: Record<string, string> = {
    BITCOIN: 'https://mempool.space/tx/',
    ETHEREUM: 'https://etherscan.io/tx/',
    SOLANA: 'https://solscan.io/tx/',
    STELLAR: 'https://stellar.expert/explorer/public/tx/',
    XRP: 'https://livenet.xrpl.org/transactions/',
  }
  return `${explorers[blockchain] ?? '#'}${encodeURIComponent(hash)}`
}

export function maskAddress(address: string) {
  return address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address
}

export function displayDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function displayNetwork(blockchain: string) {
  return blockchainLabels[blockchain as BlockchainType] ?? blockchain
}

export function displaySymbol(blockchain: string) {
  return { BITCOIN: 'BTC', ETHEREUM: 'ETH', SOLANA: 'SOL', STELLAR: 'XLM', XRP: 'XRP' }[blockchain] ?? 'NET'
}

export function makeWebhookId() {
  return `wh_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
}

export function makeUserId() {
  return `usr_${crypto.randomUUID().replaceAll('-', '')}`
}

export function makeWalletId() {
  return `wal_${crypto.randomUUID().replaceAll('-', '')}`
}

export function normalizeAddress(address: string) {
  return address.trim()
}

export function isDuplicateError(error: unknown) {
  return error instanceof Error && /unique|duplicate/i.test(error.message)
}

export function walletInputSchema() {
  return { telegramChatId: 'demo-telegram-user', blockchain: 'ETHEREUM', walletAddress: '' }
}

export const schema = { securityUser, monitoredWallet, securityAlert, paymentIntent }

export const walletUniqueConstraint = unique('monitored_wallet_user_chain_address').on(
  monitoredWallet.userId,
  monitoredWallet.blockchain,
  monitoredWallet.walletAddress,
)

export type WalletRecord = {
  id: string
  blockchain: BlockchainType
  walletAddress: string
  webhookId: string | null
  createdAt: string
}

export function toWalletRecord(wallet: MonitoredWallet): WalletRecord {
  return {
    id: wallet.id,
    blockchain: wallet.blockchain as BlockchainType,
    walletAddress: wallet.walletAddress,
    webhookId: wallet.webhookId,
    createdAt: wallet.createdAt.toISOString(),
  }
}

export function safeBlockchain(value: string): BlockchainType {
  return isBlockchainType(value) ? value : 'ETHEREUM'
}

export function alertSeverity(isOutgoing: boolean, amount: string) {
  if (isOutgoing) return 'critical'
  if (amount === '0' || amount === '0.000001') return 'warning'
  return 'info'
}

export function parseIncomingTransaction(body: Record<string, unknown>) {
  return {
    address: typeof body.address === 'string' ? body.address : typeof body.account === 'string' ? body.account : null,
    blockchain: typeof body.blockchain === 'string' ? body.blockchain : 'ETHEREUM',
    amount: typeof body.amount === 'string' || typeof body.amount === 'number' ? String(body.amount) : '0',
    token: typeof body.token === 'string' ? body.token : 'NATIVE',
    from: typeof body.from === 'string' ? body.from : 'Unknown',
    to: typeof body.to === 'string' ? body.to : 'Unknown',
    txHash: typeof body.txHash === 'string' ? body.txHash : typeof body.hash === 'string' ? body.hash : '',
  }
}

export function truncateForMessage(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-8)}` : value
}

export function securityMessage(blockchain: string, amount: string, token: string, from: string, to: string, txHash: string) {
  const outgoing = from.toLowerCase() === to.toLowerCase()
  const suspicious = outgoing || amount === '0' || amount === '0.000001'
  const warning = outgoing
    ? 'UNAUTHORIZED OUTGOING TRANSFER DETECTED!\nFunds may be leaving your wallet right now.'
    : 'POTENTIAL ADDRESS POISONING ATTACK!\nA dust transaction may be mimicking an address in your history.'
  return `SHIELD BOT SECURITY MONITOR [${blockchain}]\n\n${suspicious ? warning : 'INCOMING TRANSACTION RECEIVED'}\n\nAsset: ${amount} ${token}\nFrom: ${truncateForMessage(from)}\nTo: ${truncateForMessage(to)}\nTx hash: ${getExplorerUrl(blockchain, txHash)}`
}

export function isPublicAddressOnly(address: string) {
  return !/(private|seed|mnemonic|secret|password|key)/i.test(address)
}

export const demoTelegramChatId = 'demo-telegram-user'

export const dashboardPath = '/'

export function limitForPlan(isPremium: boolean) {
  return isPremium ? 5 : 1
}
