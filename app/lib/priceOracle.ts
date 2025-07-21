import { Connection, PublicKey } from '@solana/web3.js'
import { LIQUIDITY_STATE_LAYOUT_V4 } from '@raydium-io/raydium-sdk'
import BN from 'bn.js'

// Raydium AMM Program ID
const RAYDIUM_AMM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')

export interface TokenPrice {
  price: number
  priceNumerator: BN
  priceDenominator: BN
  lastUpdate: number
}

export class PriceOracle {
  private connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  /**
   * Get token price from Raydium pool
   * @param poolId - Raydium pool address
   * @param baseIsToken - true if our token is the base token, false if it's the quote token
   * @returns Token price data
   */
  async getTokenPriceFromPool(poolId: PublicKey, baseIsToken: boolean): Promise<TokenPrice | null> {
    try {
      // Fetch pool account data
      const poolAccount = await this.connection.getAccountInfo(poolId)
      if (!poolAccount) {
        console.error('Pool account not found')
        return null
      }

      // Decode pool state
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.data)
      
      // Get base and quote vault balances
      const baseVault = await this.connection.getTokenAccountBalance(poolState.baseVault)
      const quoteVault = await this.connection.getTokenAccountBalance(poolState.quoteVault)
      
      if (!baseVault.value || !quoteVault.value) {
        console.error('Failed to fetch vault balances')
        return null
      }

      // Calculate reserves
      const baseReserve = new BN(baseVault.value.amount)
      const quoteReserve = new BN(quoteVault.value.amount)
      
      // Adjust for decimals
      const baseDecimals = poolState.baseDecimal.toNumber()
      const quoteDecimals = poolState.quoteDecimal.toNumber()
      
      // Calculate price
      let priceNumerator: BN
      let priceDenominator: BN
      
      if (baseIsToken) {
        // Price = quote / base (how much quote token per base token)
        priceNumerator = quoteReserve
        priceDenominator = baseReserve
      } else {
        // Price = base / quote (how much base token per quote token)
        priceNumerator = baseReserve
        priceDenominator = quoteReserve
      }
      
      // Calculate decimal-adjusted price
      const decimalDiff = baseIsToken ? 
        quoteDecimals - baseDecimals : 
        baseDecimals - quoteDecimals
      
      const price = priceNumerator.toNumber() / priceDenominator.toNumber() * Math.pow(10, decimalDiff)
      
      return {
        price,
        priceNumerator,
        priceDenominator,
        lastUpdate: Date.now()
      }
    } catch (error) {
      console.error('Error fetching token price:', error)
      return null
    }
  }

  /**
   * Find Raydium pool for a token pair
   * @param tokenA - First token mint
   * @param tokenB - Second token mint
   * @returns Pool address if found
   */
  async findPool(tokenA: PublicKey, tokenB: PublicKey): Promise<PublicKey | null> {
    try {
      // Get all pools for the AMM program
      const pools = await this.connection.getProgramAccounts(RAYDIUM_AMM_PROGRAM_ID, {
        filters: [
          { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
          {
            memcmp: {
              offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
              bytes: tokenA.toBase58(),
            },
          },
          {
            memcmp: {
              offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
              bytes: tokenB.toBase58(),
            },
          },
        ],
      })

      if (pools.length === 0) {
        // Try reverse order
        const reversePools = await this.connection.getProgramAccounts(RAYDIUM_AMM_PROGRAM_ID, {
          filters: [
            { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
            {
              memcmp: {
                offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
                bytes: tokenB.toBase58(),
              },
            },
            {
              memcmp: {
                offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
                bytes: tokenA.toBase58(),
              },
            },
          ],
        })

        if (reversePools.length > 0) {
          return reversePools[0].pubkey
        }
      } else {
        return pools[0].pubkey
      }

      return null
    } catch (error) {
      console.error('Error finding pool:', error)
      return null
    }
  }

  /**
   * Get sToken price in USDC by finding pools that have the sToken
   * @param sTokenMint - The mint address of the sToken
   * @returns Token price data in USDC
   */
  async getSTokenPriceInUSDC(sTokenMint: PublicKey): Promise<TokenPrice | null> {
    try {
      // Common USDC mint on Solana
      const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      
      // First, try to find a direct sToken/USDC pool
      const filters = [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
            bytes: sTokenMint.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
            bytes: USDC_MINT.toBase58(),
          },
        },
      ]

      const poolAccounts = await this.connection.getProgramAccounts(
        RAYDIUM_AMM_PROGRAM_ID,
        { filters }
      )

      if (poolAccounts.length > 0) {
        // Found direct pool
        const poolData = poolAccounts[0]
        return await this.getTokenPriceFromPool(poolData.pubkey, true)
      }

      // If no direct pool, try reverse (USDC/sToken)
      const reverseFilters = [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('baseMint'),
            bytes: USDC_MINT.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
            bytes: sTokenMint.toBase58(),
          },
        },
      ]

      const reversePoolAccounts = await this.connection.getProgramAccounts(
        RAYDIUM_AMM_PROGRAM_ID,
        { filters: reverseFilters }
      )

      if (reversePoolAccounts.length > 0) {
        // Found reverse pool
        const poolData = reversePoolAccounts[0]
        const priceData = await this.getTokenPriceFromPool(poolData.pubkey, false)
        if (priceData) {
          // Invert the price since it's USDC/sToken
          return {
            price: 1 / priceData.price,
            priceNumerator: priceData.priceDenominator,
            priceDenominator: priceData.priceNumerator,
            lastUpdate: priceData.lastUpdate,
          }
        }
      }

      // If no Raydium pool found, you could also check Orca here
      // For now, return a default price
      console.warn('No liquidity pool found for sToken, using default price')
      return {
        price: 0.001, // Default to $0.001 per token
        priceNumerator: new BN(1),
        priceDenominator: new BN(1000),
        lastUpdate: Date.now(),
      }
    } catch (error) {
      console.error('Error getting sToken price:', error)
      return null
    }
  }

  /**
   * Get sToken price in USDC
   * @param sTokenMint - The fractional token mint
   * @returns Price in USDC with numerator/denominator for precision
   */
  async getSTokenPriceInUSDC(sTokenMint: PublicKey): Promise<TokenPrice | null> {
    // USDC mint on mainnet
    const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    
    // Try to find direct pool
    const directPool = await this.findPool(sTokenMint, USDC_MINT)
    if (directPool) {
      const baseIsToken = await this.checkIfBaseToken(directPool, sTokenMint)
      return await this.getTokenPriceFromPool(directPool, baseIsToken)
    }

    // If no direct pool, try to find SOL pool and calculate via SOL/USDC
    const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
    
    const solPool = await this.findPool(sTokenMint, SOL_MINT)
    const solUsdcPool = await this.findPool(SOL_MINT, USDC_MINT)
    
    if (solPool && solUsdcPool) {
      // Get sToken/SOL price
      const sTokenSolBaseIsToken = await this.checkIfBaseToken(solPool, sTokenMint)
      const sTokenSolPrice = await this.getTokenPriceFromPool(solPool, sTokenSolBaseIsToken)
      
      // Get SOL/USDC price
      const solUsdcBaseIsToken = await this.checkIfBaseToken(solUsdcPool, SOL_MINT)
      const solUsdcPrice = await this.getTokenPriceFromPool(solUsdcPool, solUsdcBaseIsToken)
      
      if (sTokenSolPrice && solUsdcPrice) {
        // Calculate sToken/USDC price
        const price = sTokenSolPrice.price * solUsdcPrice.price
        
        // Calculate combined numerator/denominator
        const priceNumerator = sTokenSolPrice.priceNumerator.mul(solUsdcPrice.priceNumerator)
        const priceDenominator = sTokenSolPrice.priceDenominator.mul(solUsdcPrice.priceDenominator)
        
        return {
          price,
          priceNumerator,
          priceDenominator,
          lastUpdate: Date.now()
        }
      }
    }

    return null
  }

  /**
   * Check if a token is the base token in a pool
   */
  private async checkIfBaseToken(poolId: PublicKey, tokenMint: PublicKey): Promise<boolean> {
    const poolAccount = await this.connection.getAccountInfo(poolId)
    if (!poolAccount) return false
    
    const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.data)
    return poolState.baseMint.equals(tokenMint)
  }
}

// Helper function to format price for display
export function formatPrice(price: number, decimals: number = 4): string {
  return price.toFixed(decimals)
}

// Helper function to calculate fee in SOL
export function calculateFeeInSol(
  tokenAmount: BN,
  tokenPriceUSDC: number,
  feeBps: number,
  solPriceUSDC: number
): BN {
  // Calculate token value in USDC
  const tokenValueUSDC = tokenAmount.toNumber() * tokenPriceUSDC / 1e6 // Adjust for 6 decimals
  
  // Apply fee percentage
  const feeUSDC = tokenValueUSDC * feeBps / 10000
  
  // Convert to SOL
  const feeSOL = feeUSDC / solPriceUSDC
  
  // Convert to lamports
  const feeLamports = Math.floor(feeSOL * 1e9)
  
  // Minimum fee of 0.001 SOL
  return new BN(Math.max(feeLamports, 1_000_000))
} 