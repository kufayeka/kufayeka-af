import { Box, IconButton, List, ListItem, ListItemButton, ListItemText } from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BusinessIcon from "@mui/icons-material/Business";
import LabelIcon from '@mui/icons-material/Label';
import { Fragment } from "react";
import type { AssetNode } from "../data/assetData";

export type AssetTreeItemProps = {
  node: AssetNode;
  level: number;
  expandedIds: string[];
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
};

export function AssetTreeItem({
  node,
  level,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: AssetTreeItemProps) {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expandedIds.includes(node.id);

  return (
    <Fragment>
      <ListItem disablePadding>
        <ListItemButton
          selected={node.nodeType === "asset" && selectedId === node.id}
          onClick={() => {
            if (node.nodeType === "asset") {
              onSelect(node.id);
            }
          }}
          sx={{ pl: 2 + level * 1.5, py: 0.25 }}
          aria-label={
            node.nodeType === "asset"
              ? `Pilih asset ${node.name}`
              : `Attribute ${node.name}`
          }
          title={
            node.nodeType === "asset"
              ? `Pilih asset ${node.name}`
              : `Attribute ${node.name}`
          }
        >
          {hasChildren ? (
            <IconButton
              edge="start"
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onToggle(node.id);
              }}
              aria-label={
                isExpanded
                  ? `Tutup anak asset ${node.name}`
                  : `Buka anak asset ${node.name}`
              }
              title={
                isExpanded
                  ? `Tutup anak asset ${node.name}`
                  : `Buka anak asset ${node.name}`
              }
              sx={{ mr: 0.5 }}
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          ) : (
            <Box sx={{ width: 36 }} />
          )}
          {node.nodeType === "asset" ? (
            <BusinessIcon fontSize="small" sx={{ mr: 0.5 }} />
          ) : (
            <LabelIcon fontSize="small" sx={{ mr: 0.5 }} />
          )}
          <ListItemText
            primary={node.name}
            primaryTypographyProps={{ variant: "body2" }}
          />
        </ListItemButton>
      </ListItem>
      {hasChildren && isExpanded ? (
        <List disablePadding>
          {node.children?.map((child) => (
            <AssetTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </List>
      ) : null}
    </Fragment>
  );
}
