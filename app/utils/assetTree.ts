import type { AssetListItem, AssetNode } from "../data/assetData";

export function buildAssetTree(assets: AssetListItem[]): AssetNode[] {
  const nodes = new Map<
    string,
    AssetNode & { parentId: string | null; attributeNodes: AssetNode[] }
  >();

  assets.forEach((asset) => {
    const attributeNodes: AssetNode[] = (asset.attributes ?? []).map(
      (attribute) => ({
        id: `${asset.id}::${attribute.templateItemId}`,
        name: `${attribute.templateItem.name}: ${stringifyValue(
          attribute.value
        )}`,
        nodeType: "attribute",
      })
    );

    nodes.set(asset.id, {
      id: asset.id,
      name: asset.name,
      nodeType: "asset",
      children: attributeNodes,
      attributeNodes,
      parentId: asset.parentAssetId,
    });
  });

  const roots: AssetNode[] = [];

  nodes.forEach((node) => {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)?.children?.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (list: AssetNode[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((item) => {
      if (item.children?.length) {
        sortTree(item.children);
      }
    });
  };

  sortTree(roots);
  return roots;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const json = JSON.stringify(value);
    return json.length > 40 ? `${json.slice(0, 40)}…` : json;
  } catch {
    return "[object]";
  }
}

export function filterAssetTree(
  tree: AssetNode[],
  searchValue: string
): AssetNode[] {
  if (!searchValue.trim()) {
    return tree;
  }

  const term = searchValue.trim().toLowerCase();

  const filterNodes = (nodes: AssetNode[]): AssetNode[] => {
    const result: AssetNode[] = [];

    nodes.forEach((node) => {
      const childMatches = node.children ? filterNodes(node.children) : [];
      const isMatch = node.name.toLowerCase().includes(term);

      if (isMatch || childMatches.length > 0) {
        result.push({
          ...node,
          children: childMatches.length > 0 ? childMatches : node.children,
        });
      }
    });

    return result;
  };

  return filterNodes(tree);
}
