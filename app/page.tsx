"use client";

import { Box, CssBaseline, Tab, Tabs, Typography } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { AppHeader } from "./components/AppHeader";
import { AssetExplorer } from "./components/AssetExplorer";
import { AssetManagement } from "./components/AssetManagement";
import { TabPanel } from "./components/TabPanel";
import { TemplateManagement } from "./components/TemplateManagement";
import type {
  AssetAttributeInput,
  AssetDetail,
  AssetListItem,
  TemplateSummary,
} from "./data/assetData";
import { buildAssetTree, filterAssetTree } from "./utils/assetTree";

export default function Home() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState({
    name: "",
    description: "",
    parentAssetId: "",
    assetAttributeTemplateId: "",
  });
  const [attributeValues, setAttributeValues] = useState<
    AssetAttributeInput[]
  >([]);
  const [templateManagementId, setTemplateManagementId] =
    useState<string>("");
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
  });
  const [itemForm, setItemForm] = useState({
    name: "",
    dataType: "",
    unit: "",
    description: "",
    defaultValue: "",
  });
  const [selectedTemplateItemId, setSelectedTemplateItemId] = useState<
    string | null
  >(null);
  const [assetSearch, setAssetSearch] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAssetTemplate = useMemo(
    () =>
      templates.find(
        (template) => template.id === assetForm.assetAttributeTemplateId
      ) ?? null,
    [assetForm.assetAttributeTemplateId, templates]
  );

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateManagementId),
    [templateManagementId, templates]
  );

  const assetTree = useMemo(
    () => buildAssetTree(assets),
    [assets]
  );

  const filteredTree = useMemo(
    () => filterAssetTree(assetTree, assetSearch),
    [assetSearch, assetTree]
  );

  const handleToggle = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue === 0 ? 0 : 1);
  };

  const handleTemplateChange = (event: SelectChangeEvent<string>) => {
    setAssetForm((prev) => ({
      ...prev,
      assetAttributeTemplateId: event.target.value,
    }));
  };

  const handleParentAssetChange = (event: SelectChangeEvent<string>) => {
    setAssetForm((prev) => ({
      ...prev,
      parentAssetId: event.target.value,
    }));
  };

  const handleTemplateSelect = (event: SelectChangeEvent<string>) => {
    const nextId = event.target.value;
    setTemplateManagementId(nextId);
    const nextTemplate = templates.find((template) => template.id === nextId);

    setTemplateForm({
      name: nextTemplate?.name ?? "",
      description: nextTemplate?.description ?? "",
    });
    setItemForm({
      name: "",
      dataType: "",
      unit: "",
      description: "",
      defaultValue: "",
    });
    setSelectedTemplateItemId(null);
  };

  const handleTemplateFieldChange = (
    field: "name" | "description",
    value: string
  ) => {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemFieldChange = (
    field: "name" | "dataType" | "unit" | "description" | "defaultValue",
    value: string
  ) => {
    setItemForm((prev) => ({ ...prev, [field]: value }));
  };

  const stringifyValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  };

  const mapAttributeToInput = (attribute: AssetDetail["attributes"][number]) => ({
    id: attribute.id,
    templateItemId: attribute.templateItemId,
    value: stringifyValue(attribute.value),
    templateItem: attribute.templateItem,
  });

  const handleSelectTemplateItem = (itemId: string) => {
    const item = selectedTemplate?.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    setSelectedTemplateItemId(itemId);
    setItemForm({
      name: item.name,
      dataType: item.dataType,
      unit: item.unit,
      description: item.description,
      defaultValue: stringifyValue(item.defaultValue),
    });
  };

  const handleAssetFieldChange = (
    field: "name" | "description",
    value: string
  ) => {
    setAssetForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAttributeValueChange = (
    templateItemId: string,
    value: string
  ) => {
    setAttributeValues((prev) =>
      prev.map((attribute) =>
        attribute.templateItemId === templateItemId
          ? { ...attribute, value }
          : attribute
      )
    );
  };

  const handleCreateAsset = async () => {
    if (!assetForm.name.trim()) {
      setErrorMessage("Nama asset wajib diisi.");
      return;
    }

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetForm.name,
          description: assetForm.description || null,
          parentAssetId: assetForm.parentAssetId || null,
          assetAttributeTemplateId: assetForm.assetAttributeTemplateId || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal membuat asset");
      }

      const data = (await response.json()) as { asset: AssetListItem };
      await refreshAssets(data.asset.id);
      setSelectedAssetId(data.asset.id);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal membuat asset.");
    }
  };

  const handleUpdateAsset = async () => {
    if (!selectedAssetId) {
      setErrorMessage("Pilih asset terlebih dahulu.");
      return;
    }

    try {
      const response = await fetch(`/api/assets/${selectedAssetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetForm.name,
          description: assetForm.description || null,
          parentAssetId: assetForm.parentAssetId || null,
          assetAttributeTemplateId: assetForm.assetAttributeTemplateId || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal update asset");
      }

      await refreshAssets(selectedAssetId);
      await loadAssetDetail(selectedAssetId);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal update asset.");
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAssetId) {
      setErrorMessage("Pilih asset terlebih dahulu.");
      return;
    }

    if (!window.confirm("Hapus asset ini?")) {
      return;
    }

    try {
      const response = await fetch(`/api/assets/${selectedAssetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Gagal delete asset");
      }

      await refreshAssets();
      setSelectedAssetId(null);
      setAssetForm({
        name: "",
        description: "",
        parentAssetId: "",
        assetAttributeTemplateId: "",
      });
      setAttributeValues([]);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menghapus asset.");
    }
  };

  const handleSaveAttributes = async () => {
    if (!selectedAssetId) {
      setErrorMessage("Pilih asset terlebih dahulu.");
      return;
    }

    try {
      const response = await fetch("/api/asset-attributes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: selectedAssetId,
          attributes: attributeValues.map((attribute) => ({
            templateItemId: attribute.templateItemId,
            value: attribute.value ?? null,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal simpan attribute");
      }

      const data = (await response.json()) as {
        attributes: AssetDetail["attributes"];
      };
      setAttributeValues(data.attributes.map(mapAttributeToInput));
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menyimpan attribute.");
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateForm.name.trim()) {
      setErrorMessage("Nama template wajib diisi.");
      return;
    }

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateForm.name,
          description: templateForm.description || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal membuat template");
      }

      const data = (await response.json()) as { template: TemplateSummary };
      await refreshTemplates(data.template.id);
      setTemplateManagementId(data.template.id);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal membuat template.");
    }
  };

  const handleUpdateTemplate = async () => {
    if (!templateManagementId) {
      setErrorMessage("Pilih template terlebih dahulu.");
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateManagementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateForm.name,
          description: templateForm.description || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal update template");
      }

      await refreshTemplates(templateManagementId);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal update template.");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateManagementId) {
      setErrorMessage("Pilih template terlebih dahulu.");
      return;
    }

    if (!window.confirm("Hapus template ini?")) {
      return;
    }

    try {
      const response = await fetch(`/api/templates/${templateManagementId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Gagal delete template");
      }

      await refreshTemplates();
      setTemplateManagementId("");
      setTemplateForm({ name: "", description: "" });
      setItemForm({
        name: "",
        dataType: "",
        unit: "",
        description: "",
        defaultValue: "",
      });
      setSelectedTemplateItemId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menghapus template.");
    }
  };

  const handleAddItem = async () => {
    if (!templateManagementId) {
      setErrorMessage("Pilih template terlebih dahulu.");
      return;
    }

    if (!itemForm.name.trim() || !itemForm.dataType.trim()) {
      setErrorMessage("Nama dan data type wajib diisi.");
      return;
    }

    try {
      const response = await fetch("/api/template-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetAttributeTemplateId: templateManagementId,
          name: itemForm.name,
          description: itemForm.description || null,
          dataType: itemForm.dataType,
          unit: itemForm.unit || null,
          defaultValue: itemForm.defaultValue || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal tambah item");
      }

      await refreshTemplates(templateManagementId);
      setItemForm({
        name: "",
        dataType: "",
        unit: "",
        description: "",
        defaultValue: "",
      });
      setSelectedTemplateItemId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menambah item template.");
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedTemplateItemId) {
      setErrorMessage("Pilih item template terlebih dahulu.");
      return;
    }

    try {
      const response = await fetch(
        `/api/template-items/${selectedTemplateItemId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemForm.name,
            description: itemForm.description || null,
            dataType: itemForm.dataType,
            unit: itemForm.unit || null,
            defaultValue: itemForm.defaultValue || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Gagal update item");
      }

      await refreshTemplates(templateManagementId);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal update item template.");
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedTemplateItemId) {
      setErrorMessage("Pilih item template terlebih dahulu.");
      return;
    }

    if (!window.confirm("Hapus item template ini?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/template-items/${selectedTemplateItemId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Gagal delete item");
      }

      await refreshTemplates(templateManagementId);
      setItemForm({
        name: "",
        dataType: "",
        unit: "",
        description: "",
        defaultValue: "",
      });
      setSelectedTemplateItemId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menghapus item template.");
    }
  };

  const createAttributeValuesFromTemplate = (template: TemplateSummary) =>
    template.items.map((item) => ({
      id: `temp-${item.id}`,
      templateItemId: item.id,
      value: stringifyValue(item.defaultValue),
      templateItem: item,
    }));

  const refreshAssets = async (selectedId?: string) => {
    const response = await fetch("/api/assets");
    if (!response.ok) {
      throw new Error("Gagal mengambil assets");
    }
    const data = (await response.json()) as { assets: AssetListItem[] };
    setAssets(data.assets);

    if (selectedId) {
      setSelectedAssetId(selectedId);
    } else if (selectedAssetId && !data.assets.some((a) => a.id === selectedAssetId)) {
      setSelectedAssetId(null);
    }
  };

  const refreshTemplates = async (selectedId?: string) => {
    const response = await fetch("/api/templates");
    if (!response.ok) {
      throw new Error("Gagal mengambil templates");
    }
    const data = (await response.json()) as { templates: TemplateSummary[] };
    setTemplates(data.templates);

    if (selectedId) {
      setTemplateManagementId(selectedId);
    }
  };

  const loadAssetDetail = async (assetId: string) => {
    const response = await fetch(`/api/assets/${assetId}`);
    if (!response.ok) {
      throw new Error("Gagal mengambil detail asset");
    }
    const data = (await response.json()) as { asset: AssetDetail };
    const asset = data.asset;

    setAssetForm({
      name: asset.name,
      description: asset.description ?? "",
      parentAssetId: asset.parentAssetId ?? "",
      assetAttributeTemplateId: asset.assetAttributeTemplateId ?? "",
    });
    setAttributeValues((asset.attributes ?? []).map(mapAttributeToInput));
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([refreshAssets(), refreshTemplates()]);
      } catch (error) {
        console.error(error);
        setErrorMessage("Gagal memuat data awal.");
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedAssetId) {
      return;
    }

    const load = async () => {
      try {
        await loadAssetDetail(selectedAssetId);
      } catch (error) {
        console.error(error);
        setErrorMessage("Gagal memuat detail asset.");
      }
    };

    load();
  }, [selectedAssetId]);

  useEffect(() => {
    if (selectedAssetId) {
      return;
    }

    if (selectedAssetTemplate) {
      setAttributeValues(createAttributeValuesFromTemplate(selectedAssetTemplate));
    } else {
      setAttributeValues([]);
    }
  }, [selectedAssetId, selectedAssetTemplate]);

  useEffect(() => {
    if (!templateManagementId) {
      setTemplateForm({ name: "", description: "" });
      setItemForm({
        name: "",
        dataType: "",
        unit: "",
        description: "",
        defaultValue: "",
      });
      return;
    }

    const template = templates.find((entry) => entry.id === templateManagementId);
    if (template) {
      setTemplateForm({
        name: template.name,
        description: template.description ?? "",
      });
    }
  }, [templateManagementId, templates]);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CssBaseline />
      <AppHeader />
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <AssetExplorer
          assetTree={filteredTree}
          expandedIds={expandedIds}
          selectedAssetId={selectedAssetId}
          searchValue={assetSearch}
          onSearchChange={setAssetSearch}
          onToggle={handleToggle}
          onSelect={setSelectedAssetId}
        />

        <Box
          component="section"
          sx={{ width: "70%", height: "100%", overflow: "auto", p: 3 }}
          aria-label="Asset dan template workspace"
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Tab asset dan template"
          >
            <Tab
              label="Asset Management"
              id="asset-template-tab-0"
              aria-controls="asset-template-tabpanel-0"
            />
            <Tab
              label="Template Management"
              id="asset-template-tab-1"
              aria-controls="asset-template-tabpanel-1"
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <AssetManagement
              assetForm={assetForm}
              assets={assets}
              templates={templates}
              attributeValues={attributeValues}
              onTemplateChange={handleTemplateChange}
              onParentAssetChange={handleParentAssetChange}
              onAssetFieldChange={handleAssetFieldChange}
              onAttributeValueChange={handleAttributeValueChange}
              onCreateAsset={handleCreateAsset}
              onUpdateAsset={handleUpdateAsset}
              onDeleteAsset={handleDeleteAsset}
              onSaveAttributes={handleSaveAttributes}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <TemplateManagement
              templates={templates}
              selectedTemplateId={templateManagementId}
              selectedTemplate={selectedTemplate ?? undefined}
              selectedItemId={selectedTemplateItemId}
              templateForm={templateForm}
              itemForm={itemForm}
              onTemplateSelect={handleTemplateSelect}
              onTemplateFieldChange={handleTemplateFieldChange}
              onItemFieldChange={handleItemFieldChange}
              onSelectItem={handleSelectTemplateItem}
              onCreateTemplate={handleCreateTemplate}
              onUpdateTemplate={handleUpdateTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
            />
          </TabPanel>
        </Box>
      </Box>
      {errorMessage ? (
        <Box sx={{ px: 3, pb: 2 }} aria-live="polite">
          <Typography color="error" variant="body2">
            {errorMessage}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
