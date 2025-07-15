export const IDL = {
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
          "isSigner": false
        },
        {
          "name": "vaultState",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
          "isMut": true,
          "isSigner": false
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
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "mintFractional",
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
    },
    {
      "name": "redeemNft",
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
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
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
          "name": "userFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultFractionalAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultSpecificNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "userSpecificNftAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "fractionalMint",
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
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "collectionMint",
            "type": "publicKey"
          },
          {
            "name": "creator",
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
          },
          {
            "name": "depositFeeRate",
            "type": "u16"
          },
          {
            "name": "randomRedeemFeeRate",
            "type": "u16"
          },
          {
            "name": "specificRedeemFeeRate",
            "type": "u16"
          },
          {
            "name": "totalFeesCollected",
            "type": "u64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "VaultInactive",
      "msg": "Vault is not active"
    },
    {
      "code": 6001,
      "name": "WrongCollection",
      "msg": "NFT does not belong to the correct collection"
    },
    {
      "code": 6002,
      "name": "InsufficientTokens",
      "msg": "Insufficient tokens for redemption"
    },
    {
      "code": 6003,
      "name": "NoNftsAvailable",
      "msg": "No NFTs available for redemption"
    },
    {
      "code": 6004,
      "name": "InvalidFeeRate",
      "msg": "Invalid fee rate"
    },
    {
      "code": 6005,
      "name": "CollectionNotVerified",
      "msg": "Collection not verified"
    },
    {
      "code": 6006,
      "name": "CollectionMetadataMissing",
      "msg": "Collection metadata missing"
    },
    {
      "code": 6007,
      "name": "MissingVaultAta",
      "msg": "Missing vault NFT token account"
    },
    {
      "code": 6008,
      "name": "MissingFractionalAta",
      "msg": "Missing user fractional token account"
    }
  ]
}; 