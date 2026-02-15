import { Parser, emitMicheline } from "@taquito/michel-codec";

const parser = new Parser();

const FA2_TYPES = {
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

function buildMintParam(hasRoyalties: boolean) {
  const baseFields: any[] = [
    { prim: "address", annots: ["%to_"] },
    {
      prim: "pair",
      args: [
        { prim: "nat", annots: ["%token_id"] },
        {
          prim: "pair",
          args: [
            { prim: "map", annots: ["%metadata"], args: [{ prim: "string" }, { prim: "bytes" }] },
            { prim: "nat", annots: ["%amount"] },
          ],
        },
      ],
    },
  ];

  if (hasRoyalties) {
    baseFields[1] = {
      prim: "pair",
      args: [
        { prim: "nat", annots: ["%token_id"] },
        {
          prim: "pair",
          args: [
            { prim: "map", annots: ["%metadata"], args: [{ prim: "string" }, { prim: "bytes" }] },
            {
              prim: "pair",
              args: [
                { prim: "nat", annots: ["%amount"] },
                {
                  prim: "pair",
                  args: [
                    { prim: "address", annots: ["%royalty_address"] },
                    { prim: "nat", annots: ["%royalty_percent"] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  return { prim: "pair", args: baseFields };
}

function buildParameter(styleId: string) {
  const hasRoyalties = styleId === "fa2-royalties" || styleId === "fa2-full";
  const hasMultiMinter = styleId === "fa2-multiminter" || styleId === "fa2-full";
  const hasPause = styleId === "fa2-full";

  const entrypoints: any[] = [
    { prim: "pair", annots: ["%mint"], args: buildMintParam(hasRoyalties).args },
    FA2_TYPES.transferParam,
    FA2_TYPES.updateOperatorsParam,
    FA2_TYPES.balanceOfParam,
  ];

  const entrypointNames = ["%mint", "%transfer", "%update_operators", "%balance_of"];

  if (hasRoyalties) {
    entrypoints.push({
      prim: "pair", annots: ["%set_royalties"],
      args: [
        { prim: "nat", annots: ["%token_id"] },
        {
          prim: "pair",
          args: [
            { prim: "address", annots: ["%royalty_address"] },
            { prim: "nat", annots: ["%royalty_percent"] },
          ],
        },
      ],
    });
    entrypointNames.push("%set_royalties");
  }

  if (hasMultiMinter) {
    entrypoints.push({ prim: "address", annots: ["%add_minter"] });
    entrypoints.push({ prim: "address", annots: ["%remove_minter"] });
    entrypointNames.push("%add_minter", "%remove_minter");
  }

  if (hasPause) {
    entrypoints.push({ prim: "bool", annots: ["%set_pause"] });
    entrypointNames.push("%set_pause");
  }

  let result = entrypoints[entrypoints.length - 1];
  for (let i = entrypoints.length - 2; i >= 0; i--) {
    const ep = entrypoints[i];
    const annotated = ep.annots
      ? ep
      : { ...ep, annots: [entrypointNames[i]] };
    result = { prim: "or", args: [annotated, result] };
  }

  return { prim: "parameter", args: [result] };
}

function buildStorageType(styleId: string) {
  const hasRoyalties = styleId === "fa2-royalties" || styleId === "fa2-full";
  const hasMultiMinter = styleId === "fa2-multiminter" || styleId === "fa2-full";
  const hasPause = styleId === "fa2-full";

  const fields: any[] = [
    { prim: "address", annots: ["%admin"] },
    { prim: "nat", annots: ["%next_token_id"] },
    {
      prim: "big_map", annots: ["%ledger"],
      args: [
        { prim: "pair", args: [{ prim: "address" }, { prim: "nat" }] },
        { prim: "nat" },
      ],
    },
    {
      prim: "big_map", annots: ["%operators"],
      args: [
        {
          prim: "pair",
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
        { prim: "unit" },
      ],
    },
    {
      prim: "big_map", annots: ["%token_metadata"],
      args: [{ prim: "nat" }, FA2_TYPES.tokenMetadataValue],
    },
    {
      prim: "big_map", annots: ["%metadata"],
      args: [{ prim: "string" }, { prim: "bytes" }],
    },
  ];

  if (hasMultiMinter) {
    fields.push({
      prim: "big_map", annots: ["%minters"],
      args: [{ prim: "address" }, { prim: "bool" }],
    });
  }

  if (hasRoyalties) {
    fields.push({
      prim: "big_map", annots: ["%royalties"],
      args: [
        { prim: "nat" },
        {
          prim: "pair",
          args: [
            { prim: "address", annots: ["%royalty_address"] },
            { prim: "nat", annots: ["%royalty_percent"] },
          ],
        },
      ],
    });
  }

  if (hasPause) {
    fields.push({ prim: "bool", annots: ["%paused"] });
  }

  let result = fields[fields.length - 1];
  for (let i = fields.length - 2; i >= 0; i--) {
    result = { prim: "pair", args: [fields[i], result] };
  }

  return { prim: "storage", args: [result] };
}

function buildCode(styleId: string) {
  const hasRoyalties = styleId === "fa2-royalties" || styleId === "fa2-full";
  const hasMultiMinter = styleId === "fa2-multiminter" || styleId === "fa2-full";
  const hasPause = styleId === "fa2-full";

  const assertAdmin = [
    { prim: "DUP" },
    { prim: "CAR" },
    { prim: "SENDER" },
    { prim: "COMPARE" },
    { prim: "EQ" },
    { prim: "IF", args: [[], [{ prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_NOT_ADMIN" }] }, { prim: "FAILWITH" }]] },
  ];

  const assertMinter = hasMultiMinter
    ? [
        { prim: "DUP" },
        ...getFieldAccess("minters", styleId),
        { prim: "SENDER" },
        { prim: "MEM" },
        { prim: "IF", args: [
          [],
          [
            { prim: "DUP" },
            { prim: "CAR" },
            { prim: "SENDER" },
            { prim: "COMPARE" },
            { prim: "EQ" },
            { prim: "IF", args: [[], [{ prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_NOT_MINTER" }] }, { prim: "FAILWITH" }]] },
          ],
        ] },
      ]
    : assertAdmin;

  const pauseCheck = hasPause
    ? [
        { prim: "DUP" },
        ...getFieldAccess("paused", styleId),
        { prim: "IF", args: [[{ prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_PAUSED" }] }, { prim: "FAILWITH" }], []] },
      ]
    : [];

  const mintCode = [
    ...pauseCheck,
    ...assertMinter,
    { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_MINT_IMPLEMENTED" }] },
    { prim: "FAILWITH" },
  ];

  const transferCode = [
    ...pauseCheck,
    { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_TRANSFER_IMPLEMENTED" }] },
    { prim: "FAILWITH" },
  ];

  const updateOpsCode = [
    { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_UPDATE_OPS_IMPLEMENTED" }] },
    { prim: "FAILWITH" },
  ];

  const balanceOfCode = [
    { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_BALANCE_IMPLEMENTED" }] },
    { prim: "FAILWITH" },
  ];

  let branches: any[] = [mintCode, transferCode, updateOpsCode, balanceOfCode];

  if (hasRoyalties) {
    branches.push([
      ...assertAdmin,
      { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_ROYALTIES_IMPLEMENTED" }] },
      { prim: "FAILWITH" },
    ]);
  }
  if (hasMultiMinter) {
    branches.push([
      ...assertAdmin,
      { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_ADD_MINTER_IMPLEMENTED" }] },
      { prim: "FAILWITH" },
    ]);
    branches.push([
      ...assertAdmin,
      { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_REMOVE_MINTER_IMPLEMENTED" }] },
      { prim: "FAILWITH" },
    ]);
  }
  if (hasPause) {
    branches.push([
      ...assertAdmin,
      { prim: "PUSH", args: [{ prim: "string" }, { string: "FA2_PAUSE_IMPLEMENTED" }] },
      { prim: "FAILWITH" },
    ]);
  }

  let codeBody: any[] = buildIfLeftTree(branches);

  return {
    prim: "code",
    args: [[
      { prim: "UNPAIR" },
      ...codeBody,
    ]],
  };
}

function buildIfLeftTree(branches: any[][]): any[] {
  if (branches.length === 1) return branches[0];
  if (branches.length === 2) {
    return [{ prim: "IF_LEFT", args: [branches[0], branches[1]] }];
  }
  return [{
    prim: "IF_LEFT",
    args: [
      branches[0],
      buildIfLeftTree(branches.slice(1)),
    ],
  }];
}

function getFieldAccess(field: string, styleId: string): any[] {
  const hasMultiMinter = styleId === "fa2-multiminter" || styleId === "fa2-full";
  const hasRoyalties = styleId === "fa2-royalties" || styleId === "fa2-full";

  if (field === "minters" && hasMultiMinter) {
    const idx = 6;
    const cdrs = Array(idx).fill({ prim: "CDR" });
    return [...cdrs, { prim: "CAR" }];
  }

  if (field === "paused") {
    let idx = 6;
    if (hasMultiMinter) idx++;
    if (hasRoyalties) idx++;
    const cdrs = Array(idx).fill({ prim: "CDR" });
    return cdrs;
  }

  return [{ prim: "CAR" }];
}

export function getFA2Michelson(styleId: string): any[] {
  const parameter = buildParameter(styleId);
  const storage = buildStorageType(styleId);
  const code = buildCode(styleId);
  return [parameter, storage, code];
}

export function getFA2MichelineString(styleId: string): string {
  const michelson = getFA2Michelson(styleId);
  return michelson.map((section: any) => emitMicheline(section)).join("\n");
}

export function validateMichelson(styleId: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    const michelineStr = getFA2MichelineString(styleId);
    const parsed = parser.parseScript(michelineStr);
    if (!parsed || parsed.length === 0) {
      errors.push("Parser returned empty result");
    }
  } catch (err: any) {
    errors.push(`Michelson validation failed: ${err.message}`);
  }
  return { valid: errors.length === 0, errors };
}

export function getStorageTypeForStyle(styleId: string) {
  return buildStorageType(styleId);
}

export const FA2_ENTRYPOINT_TYPES = FA2_TYPES;
