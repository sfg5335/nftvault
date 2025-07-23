export type FractionalVault = {
  "version": "0.1.0",
  "name": "fractional_vault",
  "instructions": [
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMint",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "This is manually validated since it might not be a Mint account"
          ]
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Pre-generated vanity mint that will be used for sNFT tokens",
            "This mint should end in \"smol\" for branding purposes - not yet initialized"
          ]
        },
        {
          "name": "mintKeypair",
          "isMut": false,
          "isSigner": true,
          "docs": [
            "The keypair for the sNFT mint (must sign the transaction)"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "depositNft",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nftMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "nftMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionAuthority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionMasterEdition",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lpSolVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "depositNftWithPrice",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nftMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "nftMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionAuthority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionMasterEdition",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lpSolVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "redeemSpecificNft",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nftMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lpSolVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "VaultState",
      "docs": [
        "State account for the vault - manages sNFT (smol NFT) fractionalization",
        "Immutable after creation for trustless operation"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "publicKey"
          },
          {
            "name": "collectionMint",
            "type": "publicKey"
          },
          {
            "name": "fractionalMint",
            "type": "publicKey"
          },
          {
            "name": "totalDeposits",
            "type": "u64"
          },
          {
            "name": "totalFractionsMinted",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "WrongCollection",
      "msg": "NFT does not belong to the correct collection"
    },
    {
      "code": 6001,
      "name": "InsufficientTokens",
      "msg": "Insufficient tokens for redemption"
    },
    {
      "code": 6002,
      "name": "NoNftsAvailable",
      "msg": "No NFTs available for redemption"
    },
    {
      "code": 6003,
      "name": "InvalidMetadata",
      "msg": "Invalid metadata account"
    },
    {
      "code": 6004,
      "name": "InvalidMetadataOwner",
      "msg": "Invalid metadata account owner"
    },
    {
      "code": 6005,
      "name": "MissingVaultAta",
      "msg": "Missing vault NFT token account"
    },
    {
      "code": 6006,
      "name": "MissingFractionalAta",
      "msg": "Missing user fractional token account"
    },
    {
      "code": 6007,
      "name": "InvalidTokenAmount",
      "msg": "Invalid token amount"
    },
    {
      "code": 6008,
      "name": "InsufficientLiquidity",
      "msg": "Insufficient liquidity in LP pool"
    },
    {
      "code": 6009,
      "name": "NotImplemented",
      "msg": "Not implemented due to Anchor framework limitations"
    }
  ]
};

export const IDL: FractionalVault = {
  "version": "0.1.0",
  "name": "fractional_vault",
  "instructions": [
    {
      "name": "initializeVault",
      "accounts": [
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMint",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "This is manually validated since it might not be a Mint account"
          ]
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false,
          "docs": [
            "Pre-generated vanity mint that will be used for sNFT tokens",
            "This mint should end in \"smol\" for branding purposes - not yet initialized"
          ]
        },
        {
          "name": "mintKeypair",
          "isMut": false,
          "isSigner": true,
          "docs": [
            "The keypair for the sNFT mint (must sign the transaction)"
          ]
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "depositNft",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nftMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "nftMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionAuthority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionMasterEdition",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lpSolVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "depositNftWithPrice",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nftMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "nftMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionAuthority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "collectionMetadata",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "collectionMasterEdition",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lpSolVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "redeemSpecificNft",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nftMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "lpTokenAVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "lpSolVault",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "protocolTreasury",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "VaultState",
      "docs": [
        "State account for the vault - manages sNFT (smol NFT) fractionalization",
        "Immutable after creation for trustless operation"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "publicKey"
          },
          {
            "name": "collectionMint",
            "type": "publicKey"
          },
          {
            "name": "fractionalMint",
            "type": "publicKey"
          },
          {
            "name": "totalDeposits",
            "type": "u64"
          },
          {
            "name": "totalFractionsMinted",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "WrongCollection",
      "msg": "NFT does not belong to the correct collection"
    },
    {
      "code": 6001,
      "name": "InsufficientTokens",
      "msg": "Insufficient tokens for redemption"
    },
    {
      "code": 6002,
      "name": "NoNftsAvailable",
      "msg": "No NFTs available for redemption"
    },
    {
      "code": 6003,
      "name": "InvalidMetadata",
      "msg": "Invalid metadata account"
    },
    {
      "code": 6004,
      "name": "InvalidMetadataOwner",
      "msg": "Invalid metadata account owner"
    },
    {
      "code": 6005,
      "name": "MissingVaultAta",
      "msg": "Missing vault NFT token account"
    },
    {
      "code": 6006,
      "name": "MissingFractionalAta",
      "msg": "Missing user fractional token account"
    },
    {
      "code": 6007,
      "name": "InvalidTokenAmount",
      "msg": "Invalid token amount"
    },
    {
      "code": 6008,
      "name": "InsufficientLiquidity",
      "msg": "Insufficient liquidity in LP pool"
    },
    {
      "code": 6009,
      "name": "NotImplemented",
      "msg": "Not implemented due to Anchor framework limitations"
    }
  ]
};
