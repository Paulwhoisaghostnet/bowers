export const FA2_TYPES = {
  tokenMetadataValue: {
    prim: "pair",
    args: [
      { prim: "nat", annots: ["%token_id"] },
      { prim: "map", annots: ["%token_info"], args: [{ prim: "string" }, { prim: "bytes" }] },
    ],
  },
  transferParam: {
    prim: "list",
    args: [{
      prim: "pair",
      args: [
        { prim: "address", annots: ["%from_"] },
        {
          prim: "list", annots: ["%txs"],
          args: [{
            prim: "pair",
            args: [
              { prim: "address", annots: ["%to_"] },
              {
                prim: "pair",
                args: [
                  { prim: "nat", annots: ["%token_id"] },
                  { prim: "nat", annots: ["%amount"] },
                ],
              },
            ],
          }],
        },
      ],
    }],
  },
  updateOperatorsParam: {
    prim: "list",
    args: [{
      prim: "or",
      args: [
        {
          prim: "pair", annots: ["%add_operator"],
          args: [
            { prim: "address", annots: ["%owner"] },
            {
              prim: "pair",
              args: [
                { prim: "address", annots: ["%operator"] },
                { prim: "nat", annots: ["%token_id"] },
              ],
            },
          ],
        },
        {
          prim: "pair", annots: ["%remove_operator"],
          args: [
            { prim: "address", annots: ["%owner"] },
            {
              prim: "pair",
              args: [
                { prim: "address", annots: ["%operator"] },
                { prim: "nat", annots: ["%token_id"] },
              ],
            },
          ],
        },
      ],
    }],
  },
  balanceOfParam: {
    prim: "pair",
    args: [
      {
        prim: "list", annots: ["%requests"],
        args: [{
          prim: "pair",
          args: [
            { prim: "address", annots: ["%owner"] },
            { prim: "nat", annots: ["%token_id"] },
          ],
        }],
      },
      {
        prim: "contract", annots: ["%callback"],
        args: [{
          prim: "list",
          args: [{
            prim: "pair",
            args: [
              {
                prim: "pair", annots: ["%request"],
                args: [
                  { prim: "address", annots: ["%owner"] },
                  { prim: "nat", annots: ["%token_id"] },
                ],
              },
              { prim: "nat", annots: ["%balance"] },
            ],
          }],
        }],
      },
    ],
  },
};
