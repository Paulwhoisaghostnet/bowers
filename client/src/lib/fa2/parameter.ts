import { FA2_TYPES } from "./types";

export function buildMintParam(hasRoyalties: boolean) {
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

export function buildParameter(styleId: string) {
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
