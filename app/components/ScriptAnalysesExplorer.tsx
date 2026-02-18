import { Box, Divider, List, TextField, Typography, IconButton } from "@mui/material";
import RefreshIcon from '@mui/icons-material/Refresh';
import { ScriptTreeItem } from "./ScriptTreeItem";
import type { AnalysisScript, AnalysisCron } from "../asset-analyse/page";
import { useMemo, useState } from "react";

export type ScriptNode = {
  id: string;
  name: string;
  children: ScriptNode[];
  type: 'cron' | 'script' | 'group';
  cronExpression?: string;
  isRunning?: boolean;
};

export type ScriptAnalysesExplorerProps = {
  scripts: AnalysisScript[];
  crons: AnalysisCron[];
  selectedScriptId: string | null;
  onSelectScript: (script: AnalysisScript) => void;
  onRefresh: () => void;
};

function buildScriptTree(scripts: AnalysisScript[], crons: AnalysisCron[]): ScriptNode[] {
    const onRequestScripts = scripts.filter(script => script.triggerType === 'ON_REQUEST');
    const scheduledScripts = scripts.filter(script => script.triggerType === 'SCHEDULED');

    const cronNodes: ScriptNode[] = crons.map(cron => {
        const children = scheduledScripts
            .filter(script => script.cronId === cron.id)
            .map(script => ({
                id: script.id,
                name: script.name,
                type: 'script' as const,
                children: [],
            }));

        return {
            id: cron.id,
            name: cron.name,
            type: 'cron' as const,
            children,
            cronExpression: cron.cronExpression,
            isRunning: cron.isRunning,
        };
    });

    const onRequestNode: ScriptNode = {
        id: 'on-request',
        name: 'On Request',
        type: 'group',
        children: onRequestScripts.map(script => ({
            id: script.id,
            name: script.name,
            type: 'script' as const,
            children: [],
        })),
    };

    return [onRequestNode, ...cronNodes];
}


export function ScriptAnalysesExplorer({
  scripts,
  crons,
  selectedScriptId,
  onSelectScript,
  onRefresh,
}: ScriptAnalysesExplorerProps) {
  const [searchValue, setSearchValue] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>(['on-request']);

  const scriptTree = useMemo(() => buildScriptTree(scripts, crons), [scripts, crons]);

  const handleToggle = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelect = (node: ScriptNode) => {
    if (node.type === 'script') {
        const script = scripts.find(s => s.id === node.id);
        if (script) {
            onSelectScript(script);
        }
    }
  };

  const filteredTree = useMemo(() => {
    if (!searchValue.trim()) {
      return scriptTree;
    }
    const keyword = searchValue.trim().toLowerCase();

    function filterNodes(nodes: ScriptNode[]): ScriptNode[] {
        return nodes.map(node => {
            const children = filterNodes(node.children);
            if (children.length > 0 || node.name.toLowerCase().includes(keyword)) {
                return { ...node, children };
            }
            return null;
        }).filter((node): node is ScriptNode => node !== null);
    }

    return filterNodes(scriptTree);
  }, [searchValue, scriptTree]);

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
      aria-label="Analysis explorer"
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" gutterBottom>
            Analysis Explorer
          </Typography>
          <IconButton onClick={onRefresh} aria-label="refresh analysis tree">
            <RefreshIcon />
          </IconButton>
        </Box>
        <TextField
          fullWidth
          size="small"
          label="Cari analysis"
          placeholder="Ketik nama analysis"
          aria-label="Cari analysis"
          title="Cari analysis"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: "auto" }}>
        <List aria-label="Daftar analysis">
          {filteredTree.map((node) => (
            <ScriptTreeItem
              key={node.id}
              node={node}
              level={0}
              expandedIds={expandedIds}
              selectedId={selectedScriptId}
              onToggle={handleToggle}
              onSelect={handleSelect}
            />
          ))}
        </List>
      </Box>
    </Box>
  );
}
