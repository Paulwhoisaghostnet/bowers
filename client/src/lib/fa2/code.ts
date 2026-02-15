export function buildIfLeftTree(branches: any[][]): any[] {
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

export function buildCode(styleId: string) {
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
