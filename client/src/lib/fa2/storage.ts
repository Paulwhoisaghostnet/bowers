import { FA2_TYPES } from "./types";

export function buildStorageType(styleId: string) {
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
