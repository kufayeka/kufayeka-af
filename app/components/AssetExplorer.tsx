import { Box, Divider, List, TextField, Typography } from "@mui/material";
import { AssetTreeItem } from "./AssetTreeItem";
import type { AssetNode } from "../data/assetData";

export type AssetExplorerProps = {
  assetTree: AssetNode[];
  expandedIds: string[];
  selectedAssetId: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

export function AssetExplorer({
  assetTree,
  expandedIds,
  selectedAssetId,
  searchValue,
  onSearchChange,
  onToggle,
  onSelect,
}: AssetExplorerProps) {
  return (
    <Box
      component="aside"
      sx={{
        width: "30%",
        borderRight: "1px solid",
        borderColor: "divider",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      aria-label="Asset explorer"
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Asset Explorer
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="Cari asset"
          placeholder="Ketik nama asset"
          aria-label="Cari asset"
          title="Cari asset"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <List aria-label="Daftar asset">
          {assetTree.map((node) => (
            <AssetTreeItem
              key={node.id}
              node={node}
              level={0}
              expandedIds={expandedIds}
              selectedId={selectedAssetId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </List>
      </Box>
    </Box>
  );
}
