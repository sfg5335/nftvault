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
          "name": "collectionMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
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
      "name": "mintFractionalExisting",
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
      "name": "mintFractionalMultiple",
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
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "numNfts",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "VaultState",
      "docs": [
        "State account for the vault"
      ],
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
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Collection",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verified",
            "type": "bool"
          },
          {
            "name": "key",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "Creator",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "address",
            "type": "publicKey"
          },
          {
            "name": "verified",
            "type": "bool"
          },
          {
            "name": "share",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Uses",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "useMethod",
            "type": {
              "defined": "UseMethod"
            }
          },
          {
            "name": "remaining",
            "type": "u64"
          },
          {
            "name": "total",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "UseMethod",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Burn"
          },
          {
            "name": "Multiple"
          },
          {
            "name": "Single"
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
    },
    {
      "code": 6009,
      "name": "InvalidTokenAmount",
      "msg": "Invalid token amount"
    },
    {
      "code": 6010,
      "name": "NotImplemented",
      "msg": "Not implemented due to Anchor framework limitations"
    }
  ],
  "metadata": {
    "address": "C9gS3LeLkmXSsokdNT3DJKLUGKwGonmPEr9333kiNo9a"
  }
};
