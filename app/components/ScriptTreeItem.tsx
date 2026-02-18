import { Box, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import {
  Folder as FolderIcon,
  Schedule as ScheduleIcon,
  Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";
import type { ScriptNode } from "./ScriptAnalysesExplorer";

export type ScriptTreeItemProps = {
  node: ScriptNode;
  level: number;
  expandedIds: string[];
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (node: ScriptNode) => void;
};

export function ScriptTreeItem({
  node,
  level,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: ScriptTreeItemProps) {
  const isExpanded = expandedIds.includes(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  const handleSelect = () => {
    onSelect(node);
  };

  const getIcon = () => {
    switch (node.type) {
      case "group":
        return <FolderIcon />;
      case "cron":
        return <ScheduleIcon />;
      case "script":
        return <DescriptionIcon />;
      default:
        return null;
    }
  };

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={handleSelect}
        sx={{ pl: 2 + level * 2 }}
      >
        <ListItemIcon onClick={handleToggle}>
          {hasChildren ? (
            isExpanded ? (
              <ExpandMoreIcon />
            ) : (
              <ChevronRightIcon />
            )
          ) : (
            <Box sx={{ width: 24 }} />
          )}
        </ListItemIcon>
        <ListItemIcon>{getIcon()}</ListItemIcon>
        <ListItemText
          primary={<Typography variant="body2" fontWeight="bold">{node.name}</Typography>}
          secondary={node.type === 'cron' ? <Typography variant="caption" color="text.secondary">{`${node.cronExpression} ${node.isRunning ? '(RUN)' : '(STOP)'}`}</Typography>: undefined}
        />
      </ListItemButton>
      {isExpanded &&
        node.children.map((child) => (
          <ScriptTreeItem
            key={child.id}
            node={child}
            level={level + 1}
            expandedIds={expandedIds}
            selectedId={selectedId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}
