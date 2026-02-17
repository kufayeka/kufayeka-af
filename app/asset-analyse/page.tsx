"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { javascript } from "@codemirror/lang-javascript";
import {
  autocompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CssBaseline,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import { AppHeader } from "../components/AppHeader";
import type { AssetListItem, TemplateItem } from "../data/assetData";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

type AnalysisInputRow = {
  id: string;
  variableName: string;
  sourceType: BindingSourceType;
  constantType: "number" | "boolean" | "string" | "array" | "object";
  attributePath: string | null;
  attributeKey?: string | null;
  constantValue: string | number | boolean;
  paramKey?: string | null;
  assetPath?: string | null;
  assetId?: string | null;
  required?: boolean;
};

type BindingSourceType = "attribute" | "constant" | "query" | "body" | "asset";

type AnalysisBindingRow = {
  id: string;
  variableName: string;
  sourceType: BindingSourceType;
  constantType: "number" | "boolean" | "string" | "array" | "object";
  attributePath: string | null;
  attributeKey?: string | null;
  constantValue: string | number | boolean;
  paramKey?: string | null;
  assetPath?: string | null;
  assetId?: string | null;
  required?: boolean;
};

type AnalysisScript = {
  id: string;
  name: string;
  description: string | null;
  script: string;
  inputs: AnalysisBindingRow[] | null;
  templateId: string | null;
  triggerType: "ON_REQUEST" | "SCHEDULED";
  cronId: string | null;
  cron?: {
    id: string;
    name: string;
  } | null;
};

type ScriptTemplate = {
  id: string;
  name: string;
  description: string | null;
  script: string;
  inputs: AnalysisInputRow[] | null;
  triggerType: "ON_REQUEST" | "SCHEDULED";
};

type AnalysisCron = {
  id: string;
  name: string;
  description: string | null;
  intervalSecond: number;
  isRunning: boolean;
  scripts?: Array<{
    id: string;
    name: string;
    triggerType: "ON_REQUEST" | "SCHEDULED";
    cronId: string | null;
  }>;
};

type AttributeOption = {
  label: string;
  value: string;
  dataType: string;
  unit: string;
  alias: string;
  path: string;
};

type AssetOption = {
  label: string;
  value: string;
};

export default function AssetAnalysePage() {
  const [activeTab, setActiveTab] = useState<"scripts" | "crons">("scripts");
  const [scripts, setScripts] = useState<AnalysisScript[]>([]);
  const [crons, setCrons] = useState<AnalysisCron[]>([]);
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [scriptForm, setScriptForm] = useState({
    name: "",
    description: "",
    script: "// Write analysis script here\n",
    templateId: "",
    triggerType: "ON_REQUEST" as "ON_REQUEST" | "SCHEDULED",
    cronId: "",
  });
  const [bindings, setBindings] = useState<AnalysisBindingRow[]>([]);
  const [scriptSearch, setScriptSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetListItem[]>([]);

  const attributeOptions = useMemo(
    () => buildAttributeOptions(assets),
    [assets]
  );
  const assetOptions = useMemo(() => buildAssetOptions(assets), [assets]);

  useEffect(() => {
    if (attributeOptions.length === 0) return;
    setBindings((prev) =>
      prev.map((binding) => resolveLegacyBinding(binding, attributeOptions))
    );
  }, [attributeOptions]);

  const filteredScripts = useMemo(() => {
    if (!scriptSearch.trim()) {
      return scripts;
    }
    const keyword = scriptSearch.trim().toLowerCase();
    return scripts.filter((item) =>
      [item.name, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [scriptSearch, scripts]);

  const selectedScript = useMemo(
    () => scripts.find((item) => item.id === selectedScriptId) ?? null,
    [scripts, selectedScriptId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === scriptForm.templateId) ?? null,
    [templates, scriptForm.templateId]
  );
  const isTemplateSelected = Boolean(scriptForm.templateId);

  const variableCompletionSource = (context: CompletionContext) => {
    const word = context.matchBefore(/\w+(?:\.\w+)*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const sourceVariables = scriptForm.templateId
      ? selectedTemplate?.inputs ?? []
      : bindings;

    const completions: Completion[] = sourceVariables
      .map((input) => input.variableName.trim())
      .filter(Boolean)
      .map((variableName) => ({
        label: variableName,
        type: "variable",
        apply: variableName,
      }));

    return {
      from: word.from,
      options: completions,
    };
  };

  const handleSelectScript = (script: AnalysisScript) => {
    setSelectedScriptId(script.id);
    const template = script.templateId
      ? templates.find((item) => item.id === script.templateId)
      : null;
    setScriptForm({
      name: script.name,
      description: script.description ?? "",
      script: template?.script ?? script.script,
      templateId: script.templateId ?? "",
      triggerType: script.triggerType ?? "ON_REQUEST",
      cronId: script.cronId ?? "",
    });
    if (template) {
      setBindings(
        normalizeBindings(
          template.inputs ?? [],
          script.inputs ?? null,
          attributeOptions
        )
      );
    } else {
      setBindings(
        (script.inputs ?? []).map((binding) =>
          resolveLegacyBinding(binding, attributeOptions)
        )
      );
    }
  };

  const resetForm = () => {
    setSelectedScriptId(null);
    setScriptForm({
      name: "",
      description: "",
      script: "// Write analysis script here\n",
      templateId: "",
      triggerType: "ON_REQUEST",
      cronId: "",
    });
    setBindings([]);
  };

  const handleAddBinding = () => {
    setBindings((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        variableName: "",
        sourceType: "attribute",
        constantType: "string",
        attributePath: null,
        attributeKey: null,
        constantValue: "",
        paramKey: null,
        assetPath: null,
        assetId: null,
        required: false,
      },
    ]);
  };

  const handleRemoveBinding = (index: number) => {
    setBindings((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    if (!scriptForm.name.trim()) {
      setErrorMessage("Nama analysis wajib diisi.");
      return;
    }

    if (!scriptForm.script.trim()) {
      setErrorMessage("Script tidak boleh kosong.");
      return;
    }

    try {
      const response = await fetch(
        selectedScriptId
          ? `/api/analysis-scripts/${selectedScriptId}`
          : "/api/analysis-scripts",
        {
          method: selectedScriptId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: scriptForm.name,
            description: scriptForm.description || null,
            script: selectedTemplate?.script ?? scriptForm.script,
            inputs: sanitizeBindingsForTriggerType(
              bindings,
              scriptForm.triggerType
            ),
            templateId: scriptForm.templateId || null,
            triggerType: scriptForm.triggerType,
            cronId:
              scriptForm.triggerType === "SCHEDULED"
                ? scriptForm.cronId || null
                : null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Gagal menyimpan analysis");
      }

      const data = (await response.json()) as { script: AnalysisScript };
      await refreshScripts(data.script.id);
      setSelectedScriptId(data.script.id);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menyimpan analysis.");
    }
  };

  const handleDelete = async () => {
    if (!selectedScriptId) {
      setErrorMessage("Pilih analysis terlebih dahulu.");
      return;
    }

    if (!window.confirm("Hapus analysis ini?")) {
      return;
    }

    try {
      const response = await fetch(`/api/analysis-scripts/${selectedScriptId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Gagal hapus analysis");
      }

      await refreshScripts();
      resetForm();
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menghapus analysis.");
    }
  };

  const refreshScripts = async (selectedId?: string) => {
    const response = await fetch("/api/analysis-scripts");
    if (!response.ok) {
      throw new Error("Gagal mengambil analysis scripts");
    }

    const data = (await response.json()) as { scripts: AnalysisScript[] };
    setScripts(data.scripts);

    if (selectedId) {
      setSelectedScriptId(selectedId);
    }
  };

  const refreshTemplates = async () => {
    const response = await fetch("/api/analysis-script-templates");
    if (!response.ok) {
      throw new Error("Gagal mengambil templates");
    }

    const data = (await response.json()) as { templates: ScriptTemplate[] };
    setTemplates(data.templates);
  };

  const refreshCrons = async () => {
    const response = await fetch("/api/analysis-crons");
    if (!response.ok) {
      throw new Error("Gagal mengambil cron jobs");
    }
    const data = (await response.json()) as { crons: AnalysisCron[] };
    setCrons(data.crons);
  };

  const refreshAssets = async () => {
    const response = await fetch("/api/assets");
    if (!response.ok) {
      throw new Error("Gagal mengambil assets");
    }

    const data = (await response.json()) as { assets: AssetListItem[] };
    setAssets(data.assets);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([refreshScripts(), refreshAssets(), refreshTemplates()]);
        await refreshCrons();
      } catch (error) {
        console.error(error);
        setErrorMessage("Gagal memuat data analysis.");
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      refreshAssets().catch((error) => {
        console.error(error);
      });
      refreshTemplates().catch((error) => {
        console.error(error);
      });
      refreshCrons().catch((error) => {
        console.error(error);
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    if (!selectedScript) {
      return;
    }

    setScriptForm({
      name: selectedScript.name,
      description: selectedScript.description ?? "",
      script: selectedScript.script,
      templateId: selectedScript.templateId ?? "",
      triggerType: selectedScript.triggerType ?? "ON_REQUEST",
      cronId: selectedScript.cronId ?? "",
    });
  }, [selectedScript]);

  useEffect(() => {
    if (selectedTemplate) {
      setBindings((current) =>
        normalizeBindings(selectedTemplate.inputs ?? [], current, attributeOptions)
      );
      setScriptForm((prev) => ({
        ...prev,
        script: selectedTemplate.script,
        triggerType: selectedTemplate.triggerType ?? prev.triggerType,
      }));
    }
  }, [selectedTemplate, attributeOptions]);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CssBaseline />
      <AppHeader />
      <Box sx={{ px: 3, pt: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          aria-label="Analysis tabs"
        >
          <Tab value="scripts" label="Scripts" />
          <Tab value="crons" label="Cron Generator" />
        </Tabs>
      </Box>
      {activeTab === "scripts" ? (
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
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
            <Typography variant="subtitle1" gutterBottom>
              Analysis Explorer
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Cari analysis"
              placeholder="Ketik nama analysis"
              aria-label="Cari analysis"
              title="Cari analysis"
              value={scriptSearch}
              onChange={(event) => setScriptSearch(event.target.value)}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                aria-label="Buat analysis baru"
                title="Buat analysis baru"
                onClick={resetForm}
              >
                New Analysis
              </Button>
              <Button
                variant="contained"
                aria-label="Simpan analysis"
                title="Simpan analysis"
                onClick={handleSave}
              >
                Save
              </Button>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflow: "auto" }}>
            <Stack spacing={0.5} sx={{ p: 2 }} aria-label="Daftar analysis">
              {renderScriptHierarchy({
                scripts: filteredScripts,
                crons,
                selectedScriptId,
                onSelect: handleSelectScript,
              })}
            </Stack>
          </Box>
        </Box>

        <Box
          component="section"
          sx={{ width: "70%", height: "100%", overflow: "auto", p: 3 }}
          aria-label="Analysis workspace"
        >
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Analysis Settings</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Nama analysis"
                      aria-label="Nama analysis"
                      title="Nama analysis"
                      value={scriptForm.name}
                      onChange={(event) =>
                        setScriptForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <TextField
                      label="Deskripsi"
                      aria-label="Deskripsi analysis"
                      title="Deskripsi analysis"
                      value={scriptForm.description}
                      onChange={(event) =>
                        setScriptForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <TextField
                      select
                      label="Script template"
                      aria-label="Script template"
                      title="Script template"
                      value={scriptForm.templateId}
                      onChange={(event) => {
                        const nextTemplateId = event.target.value;
                        const nextTemplate = templates.find(
                          (item) => item.id === nextTemplateId
                        );
                        setScriptForm((prev) => ({
                          ...prev,
                          templateId: nextTemplateId,
                          script: nextTemplate?.script ?? prev.script,
                          triggerType:
                            nextTemplate?.triggerType ?? prev.triggerType,
                          cronId:
                            (nextTemplate?.triggerType ?? prev.triggerType) ===
                            "SCHEDULED"
                              ? prev.cronId
                              : "",
                        }));
                        if (nextTemplate) {
                          setBindings((current) =>
                            sanitizeBindingsForTriggerType(
                              normalizeBindings(
                                nextTemplate.inputs ?? [],
                                current,
                                attributeOptions
                              ),
                              nextTemplate.triggerType ?? "ON_REQUEST"
                            )
                          );
                        }
                      }}
                      fullWidth
                    >
                      <MenuItem value="">(Tidak ada)</MenuItem>
                      {templates.map((item) => (
                        <MenuItem key={item.id} value={item.id}>
                          {item.name}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      select
                      label="Type"
                      aria-label="Analysis trigger type"
                      title="Analysis trigger type"
                      value={scriptForm.triggerType}
                      onChange={(event) => {
                        const nextTrigger = event.target.value as
                          | "ON_REQUEST"
                          | "SCHEDULED";
                        setScriptForm((prev) => ({
                          ...prev,
                          triggerType: nextTrigger,
                          cronId: nextTrigger === "SCHEDULED" ? prev.cronId : "",
                        }));
                        setBindings((current) =>
                          sanitizeBindingsForTriggerType(current, nextTrigger)
                        );
                      }}
                      fullWidth
                    >
                      <MenuItem value="ON_REQUEST">On Request</MenuItem>
                      <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="Assigned Cron"
                      aria-label="Assigned cron"
                      title="Assigned cron"
                      value={scriptForm.cronId}
                      onChange={(event) =>
                        setScriptForm((prev) => ({
                          ...prev,
                          cronId: event.target.value,
                        }))
                      }
                      fullWidth
                      disabled={scriptForm.triggerType !== "SCHEDULED"}
                    >
                      <MenuItem value="">(No cron)</MenuItem>
                      {crons.map((cron) => (
                        <MenuItem key={cron.id} value={cron.id}>
                          {cron.name} ({cron.intervalSecond}s)
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1">Variable bindings</Typography>
                    {!isTemplateSelected ? (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        aria-label="Tambah binding"
                        title="Tambah binding"
                        onClick={handleAddBinding}
                      >
                        Add Binding
                      </Button>
                    ) : null}
                  </Stack>
                  <TableContainer
                    sx={{
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Table size="small" aria-label="Tabel variable bindings">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell sx={{ width: "30%" }}>Variable</TableCell>
                          <TableCell sx={{ width: "18%" }}>Source</TableCell>
                          <TableCell sx={{ width: "20%" }}>Type</TableCell>
                          <TableCell>Value</TableCell>
                          <TableCell align="center" sx={{ width: 90 }}>
                            Required
                          </TableCell>
                          {!isTemplateSelected ? (
                            <TableCell align="center" sx={{ width: 72 }}>
                              Action
                            </TableCell>
                          ) : null}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {bindings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isTemplateSelected ? 5 : 6}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {isTemplateSelected
                                  ? "Template belum punya bindings."
                                  : "Belum ada bindings manual."}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          bindings.map((binding, index) => (
                            <TableRow key={binding.id}>
                              <TableCell>
                                {isTemplateSelected ? (
                                  binding.variableName
                                ) : (
                                  <TextField
                                    size="small"
                                    label="Variable"
                                    aria-label="Variable"
                                    title="Variable"
                                    value={binding.variableName}
                                    onChange={(event) =>
                                      setBindings((prev) =>
                                        prev.map((item, idx) =>
                                          idx === index
                                            ? {
                                                ...item,
                                                variableName: event.target.value,
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    fullWidth
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                {isTemplateSelected ? (
                                  binding.sourceType === "attribute"
                                    ? "Attribute"
                                    : binding.sourceType === "query"
                                      ? "HTTP Query"
                                      : binding.sourceType === "body"
                                        ? "Request Body"
                                        : binding.sourceType === "asset"
                                          ? "Asset"
                                          : "Constant"
                                ) : (
                                  <TextField
                                    select
                                    size="small"
                                    label="Source"
                                    aria-label="Binding source"
                                    title="Binding source"
                                    value={binding.sourceType}
                                    onChange={(event) =>
                                      setBindings((prev) =>
                                        prev.map((item, idx) =>
                                          idx === index
                                            ? {
                                                ...item,
                                                sourceType:
                                                  event.target.value as BindingSourceType,
                                                attributePath:
                                                  event.target.value === "attribute"
                                                    ? item.attributePath
                                                    : null,
                                                attributeKey:
                                                  event.target.value === "attribute"
                                                    ? item.attributeKey ?? null
                                                    : null,
                                                constantValue:
                                                  event.target.value === "constant"
                                                    ? item.constantValue
                                                    : "",
                                                paramKey:
                                                  event.target.value === "query" ||
                                                  event.target.value === "body"
                                                    ? item.paramKey ?? ""
                                                    : null,
                                                assetPath:
                                                  event.target.value === "asset"
                                                    ? item.assetPath ?? null
                                                    : null,
                                                assetId:
                                                  event.target.value === "asset"
                                                    ? item.assetId ?? null
                                                    : null,
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    fullWidth
                                  >
                                    <MenuItem value="attribute">Attribute</MenuItem>
                                    <MenuItem value="constant">Constant</MenuItem>
                                    <MenuItem
                                      value="query"
                                      disabled={scriptForm.triggerType === "SCHEDULED"}
                                    >
                                      HTTP Query
                                    </MenuItem>
                                    <MenuItem
                                      value="body"
                                      disabled={scriptForm.triggerType === "SCHEDULED"}
                                    >
                                      Request Body
                                    </MenuItem>
                                    <MenuItem value="asset">Asset</MenuItem>
                                  </TextField>
                                )}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  if (binding.sourceType === "attribute") {
                                    return (
                                      <TextField
                                        size="small"
                                        label="Type"
                                        aria-label="Attribute type"
                                        title="Attribute type"
                                        value={
                                          binding.attributeKey
                                            ? attributeOptions.find(
                                                (option) =>
                                                  option.value ===
                                                  binding.attributeKey
                                              )?.dataType ?? ""
                                            : binding.attributePath
                                              ? attributeOptions.find(
                                                  (option) =>
                                                    option.path ===
                                                    binding.attributePath
                                                )?.dataType ?? ""
                                              : ""
                                        }
                                        InputProps={{ readOnly: true }}
                                        fullWidth
                                      />
                                    );
                                  }

                                  if (binding.sourceType === "asset") {
                                    return (
                                      <TextField
                                        size="small"
                                        label="Type"
                                        aria-label="Asset type"
                                        title="Asset type"
                                        value="asset"
                                        InputProps={{ readOnly: true }}
                                        fullWidth
                                      />
                                    );
                                  }

                                  if (isTemplateSelected) {
                                    return (
                                      <TextField
                                        size="small"
                                        label="Data type"
                                        aria-label="Data type"
                                        title="Data type"
                                        value={binding.constantType}
                                        InputProps={{ readOnly: true }}
                                        fullWidth
                                      />
                                    );
                                  }

                                  return (
                                    <TextField
                                      select
                                      size="small"
                                      label="Data type"
                                      aria-label="Data type"
                                      title="Data type"
                                      value={binding.constantType}
                                      onChange={(event) =>
                                        setBindings((prev) =>
                                          prev.map((item, idx) =>
                                            idx === index
                                              ? {
                                                  ...item,
                                                  constantType: event.target
                                                    .value as AnalysisBindingRow["constantType"],
                                                  constantValue: "",
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      fullWidth
                                    >
                                      <MenuItem value="string">String</MenuItem>
                                      <MenuItem value="number">Number</MenuItem>
                                      <MenuItem value="boolean">Boolean</MenuItem>
                                      <MenuItem value="array">Array</MenuItem>
                                      <MenuItem value="object">Object</MenuItem>
                                    </TextField>
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  if (binding.sourceType === "attribute") {
                                    return (
                                      <Autocomplete
                                        options={attributeOptions}
                                        value={
                                          binding.attributeKey
                                            ? attributeOptions.find(
                                                (option) =>
                                                  option.value ===
                                                  binding.attributeKey
                                              ) ?? null
                                            : binding.attributePath
                                              ? attributeOptions.find(
                                                  (option) =>
                                                    option.path ===
                                                    binding.attributePath
                                                ) ?? null
                                              : null
                                        }
                                        onChange={(_, value) =>
                                          setBindings((prev) =>
                                            prev.map((item, idx) =>
                                              idx === index
                                                ? {
                                                    ...item,
                                                    attributePath: value?.path ?? null,
                                                    attributeKey: value?.value ?? null,
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        getOptionLabel={(option) => option.label}
                                        isOptionEqualToValue={(option, value) =>
                                          option.value === value.value
                                        }
                                        filterOptions={createFilterOptions({
                                          ignoreAccents: true,
                                          stringify: (option) =>
                                            `${option.label} ${option.alias} ${option.dataType} ${option.unit}`,
                                        })}
                                        renderOption={(props, option) => {
                                          const { key, ...rest } = props;
                                          return (
                                            <li key={key} {...rest}>
                                              <Stack>
                                                <Typography variant="body2">
                                                  {option.label}
                                                </Typography>
                                                <Typography variant="caption">
                                                  alias: {option.alias}
                                                </Typography>
                                                <Typography
                                                  variant="caption"
                                                  color="text.secondary"
                                                >
                                                  {option.dataType} {option.unit || ""}
                                                </Typography>
                                              </Stack>
                                            </li>
                                          );
                                        }}
                                        renderInput={(params) => (
                                          <TextField
                                            {...params}
                                            size="small"
                                            label="Asset attribute"
                                            aria-label="Asset attribute"
                                            title="Asset attribute"
                                          />
                                        )}
                                        fullWidth
                                      />
                                    );
                                  }

                                  if (binding.sourceType === "asset") {
                                    return (
                                      <Autocomplete
                                        options={assetOptions}
                                        value={
                                          binding.assetId
                                            ? assetOptions.find(
                                                (option) =>
                                                  option.value ===
                                                  binding.assetId
                                              ) ?? null
                                            : binding.assetPath
                                              ? assetOptions.find(
                                                  (option) =>
                                                    option.label ===
                                                    binding.assetPath
                                                ) ?? null
                                              : null
                                        }
                                        onChange={(_, value) =>
                                          setBindings((prev) =>
                                            prev.map((item, idx) =>
                                              idx === index
                                                ? {
                                                    ...item,
                                                    assetPath: value?.label ?? null,
                                                    assetId: value?.value ?? null,
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        getOptionLabel={(option) => option.label}
                                        isOptionEqualToValue={(option, value) =>
                                          option.value === value.value
                                        }
                                        renderInput={(params) => (
                                          <TextField
                                            {...params}
                                            size="small"
                                            label="Asset"
                                            aria-label="Asset"
                                            title="Asset"
                                          />
                                        )}
                                        fullWidth
                                      />
                                    );
                                  }

                                  if (
                                    binding.sourceType === "query" ||
                                    binding.sourceType === "body"
                                  ) {
                                    return (
                                      <TextField
                                        size="small"
                                        label={
                                          binding.sourceType === "query"
                                            ? "Query Key"
                                            : "Body Key"
                                        }
                                        aria-label="Request key"
                                        title="Request key"
                                        value={binding.paramKey ?? ""}
                                        onChange={(event) =>
                                          setBindings((prev) =>
                                            prev.map((item, idx) =>
                                              idx === index
                                                ? {
                                                    ...item,
                                                    paramKey: event.target.value,
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        InputProps={{ readOnly: isTemplateSelected }}
                                        fullWidth
                                      />
                                    );
                                  }

                                  if (binding.constantType === "boolean") {
                                    return (
                                      <TextField
                                        select
                                        size="small"
                                        label="Constant"
                                        aria-label="Constant"
                                        title="Constant"
                                        value={
                                          binding.constantValue === true
                                            ? "true"
                                            : binding.constantValue === false
                                              ? "false"
                                              : ""
                                        }
                                        onChange={(event) =>
                                          setBindings((prev) =>
                                            prev.map((item, idx) =>
                                              idx === index
                                                ? {
                                                    ...item,
                                                    constantValue:
                                                      event.target.value === "true",
                                                  }
                                                : item
                                            )
                                          )
                                        }
                                        fullWidth
                                      >
                                        <MenuItem value="true">true</MenuItem>
                                        <MenuItem value="false">false</MenuItem>
                                      </TextField>
                                    );
                                  }

                                  return (
                                    <TextField
                                      size="small"
                                      label={
                                        binding.constantType === "array" ||
                                        binding.constantType === "object"
                                          ? "Constant (JSON)"
                                          : "Constant"
                                      }
                                      aria-label="Constant"
                                      title="Constant"
                                      value={
                                        typeof binding.constantValue === "boolean"
                                          ? binding.constantValue
                                            ? "true"
                                            : "false"
                                          : binding.constantValue
                                      }
                                      onChange={(event) =>
                                        setBindings((prev) =>
                                          prev.map((item, idx) =>
                                            idx === index
                                              ? {
                                                  ...item,
                                                  constantValue:
                                                    binding.constantType === "number"
                                                      ? Number(event.target.value)
                                                      : event.target.value,
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      type={
                                        binding.constantType === "number"
                                          ? "number"
                                          : "text"
                                      }
                                      multiline={
                                        binding.constantType === "array" ||
                                        binding.constantType === "object"
                                      }
                                      minRows={
                                        binding.constantType === "array" ||
                                        binding.constantType === "object"
                                          ? 2
                                          : undefined
                                      }
                                      fullWidth
                                    />
                                  );
                                })()}
                              </TableCell>
                              <TableCell align="center">
                                <Checkbox
                                  checked={Boolean(binding.required)}
                                  onChange={(event) =>
                                    setBindings((prev) =>
                                      prev.map((item, idx) =>
                                        idx === index
                                          ? {
                                              ...item,
                                              required: event.target.checked,
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  inputProps={{ "aria-label": "Required" }}
                                  disabled={isTemplateSelected}
                                />
                              </TableCell>
                              {!isTemplateSelected ? (
                                <TableCell align="center">
                                  <IconButton
                                    aria-label="Hapus binding"
                                    title="Hapus binding"
                                    onClick={() => handleRemoveBinding(index)}
                                    size="small"
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              ) : null}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Script Editor</Typography>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      overflow: "hidden",
                    }}
                  >
                    <CodeMirror
                      value={
                        isTemplateSelected
                          ? selectedTemplate?.script ?? scriptForm.script
                          : scriptForm.script
                      }
                      height="360px"
                      extensions={[
                        javascript(),
                        autocompletion({ override: [variableCompletionSource] }),
                      ]}
                      editable={!isTemplateSelected}
                      onChange={(value) =>
                        setScriptForm((prev) => ({
                          ...prev,
                          script: value,
                        }))
                      }
                      aria-label="Editor script analysis"
                    />
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Button
                      variant="contained"
                      aria-label="Simpan analysis"
                      title="Simpan analysis"
                      onClick={handleSave}
                    >
                      Save Analysis
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      aria-label="Hapus analysis"
                      title="Hapus analysis"
                      onClick={handleDelete}
                    >
                      Delete Analysis
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>
      ) : (
        <CronGeneratorTab
          crons={crons}
          scripts={scripts}
          onRefresh={refreshCrons}
          onScriptsRefresh={refreshScripts}
          onError={setErrorMessage}
        />
      )}
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

type HierarchyArgs = {
  scripts: AnalysisScript[];
  crons: AnalysisCron[];
  selectedScriptId: string | null;
  onSelect: (script: AnalysisScript) => void;
};

function renderScriptHierarchy({
  scripts,
  crons,
  selectedScriptId,
  onSelect,
}: HierarchyArgs) {
  const scriptsByCron = new Map<string | null, AnalysisScript[]>();
  scripts.forEach((script) => {
    const key = script.triggerType === "SCHEDULED" ? script.cronId : null;
    const list = scriptsByCron.get(key) ?? [];
    list.push(script);
    scriptsByCron.set(key, list);
  });

  const children = new Map<string | null, AnalysisCron[]>();
  crons.forEach((cron) => {
    const list = children.get(null) ?? [];
    list.push(cron);
    children.set(null, list);
  });

  const renderScriptCard = (item: AnalysisScript, depth = 0) => (
    <Card
      key={item.id}
      variant="outlined"
      sx={{
        ml: depth * 2,
        cursor: "pointer",
        borderColor: item.id === selectedScriptId ? "primary.main" : "divider",
        bgcolor: item.id === selectedScriptId ? "action.selected" : "background.paper",
        "&:hover": {
          borderColor: "primary.light",
          bgcolor: "action.hover",
        },
      }}
      onClick={() => onSelect(item)}
    >
      <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" fontWeight="bold">
              {item.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.triggerType === "SCHEDULED" ? "Scheduled" : "On Request"}
            </Typography>
          </Box>
          {item.id === selectedScriptId ? (
            <CheckIcon color="primary" fontSize="small" />
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );

  const renderCronNode = (cron: AnalysisCron, depth: number) => {
    const scheduledScripts = (scriptsByCron.get(cron.id) ?? []).filter(
      (item) => item.triggerType === "SCHEDULED"
    );
    return (
      <Box key={cron.id} sx={{ ml: depth * 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          {cron.name} ({cron.intervalSecond}s) {cron.isRunning ? "RUN" : "STOP"}
        </Typography>
        <Stack spacing={0.5}>
          {scheduledScripts.map((item) => renderScriptCard(item, depth + 1))}
        </Stack>
      </Box>
    );
  };

  const rootCrons = children.get(null) ?? [];
  const onRequestScripts = (scriptsByCron.get(null) ?? []).filter(
    (item) => item.triggerType !== "SCHEDULED"
  );

  return (
    <>
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        On Request
      </Typography>
      {onRequestScripts.map((item) => renderScriptCard(item))}
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Scheduled By Cron
      </Typography>
      {rootCrons.map((cron) => renderCronNode(cron, 0))}
    </>
  );
}

function sanitizeBindingsForTriggerType(
  bindings: AnalysisBindingRow[],
  triggerType: "ON_REQUEST" | "SCHEDULED"
) {
  if (triggerType !== "SCHEDULED") {
    return bindings;
  }
  return bindings.map((binding) => {
    if (binding.sourceType === "query" || binding.sourceType === "body") {
      return {
        ...binding,
        sourceType: "constant",
        paramKey: null,
        constantType: "string",
        constantValue: "",
      };
    }
    return binding;
  });
}

type CronGeneratorTabProps = {
  crons: AnalysisCron[];
  scripts: AnalysisScript[];
  onRefresh: () => Promise<void>;
  onScriptsRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
};

function CronGeneratorTab({
  crons,
  scripts,
  onRefresh,
  onScriptsRefresh,
  onError,
}: CronGeneratorTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    intervalSecond: 60,
    isRunning: false,
  });

  const selected = useMemo(
    () => crons.find((item) => item.id === selectedId) ?? null,
    [crons, selectedId]
  );

  useEffect(() => {
    if (!selected) {
      return;
    }
    setForm({
      name: selected.name,
      description: selected.description ?? "",
      intervalSecond: selected.intervalSecond,
      isRunning: selected.isRunning,
    });
  }, [selected]);

  const reset = () => {
    setSelectedId(null);
    setForm({
      name: "",
      description: "",
      intervalSecond: 60,
      isRunning: false,
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      onError("Nama cron wajib diisi.");
      return;
    }
    try {
      const response = await fetch(
        selectedId ? `/api/analysis-crons/${selectedId}` : "/api/analysis-crons",
        {
          method: selectedId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            intervalSecond: form.intervalSecond,
            isRunning: form.isRunning,
          }),
        }
      );
      if (!response.ok) {
        throw new Error("Gagal menyimpan cron");
      }
      await Promise.all([onRefresh(), onScriptsRefresh()]);
      onError(null);
    } catch (error) {
      console.error(error);
      onError("Gagal menyimpan cron.");
    }
  };

  const remove = async () => {
    if (!selectedId) {
      onError("Pilih cron terlebih dahulu.");
      return;
    }
    if (!window.confirm("Hapus cron ini?")) {
      return;
    }
    try {
      const response = await fetch(`/api/analysis-crons/${selectedId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Gagal menghapus cron");
      }
      reset();
      await Promise.all([onRefresh(), onScriptsRefresh()]);
      onError(null);
    } catch (error) {
      console.error(error);
      onError((error as Error).message);
    }
  };

  const toggle = async (cronId: string, isRunning: boolean) => {
    try {
      const response = await fetch(`/api/analysis-crons/${cronId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRunning }),
      });
      if (!response.ok) {
        throw new Error("Gagal update status cron");
      }
      await onRefresh();
      onError(null);
    } catch (error) {
      console.error(error);
      onError("Gagal update status cron.");
    }
  };

  return (
    <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <Box
        component="aside"
        sx={{
          width: "30%",
          borderRight: "1px solid",
          borderColor: "divider",
          p: 2,
          overflow: "auto",
        }}
      >
        <Typography variant="subtitle1" gutterBottom>
          Cron List
        </Typography>
        <Stack spacing={1}>
          {crons.map((cron) => (
            <Card
              key={cron.id}
              variant="outlined"
              sx={{
                cursor: "pointer",
                borderColor: selectedId === cron.id ? "primary.main" : "divider",
              }}
              onClick={() => setSelectedId(cron.id)}
            >
              <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
                <Typography variant="body2" fontWeight="bold">
                  {cron.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {cron.intervalSecond}s - {cron.isRunning ? "RUN" : "STOP"}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggle(cron.id, true);
                    }}
                  >
                    Start
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggle(cron.id, false);
                    }}
                  >
                    Stop
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Box>
      <Box component="section" sx={{ width: "70%", p: 3, overflow: "auto" }}>
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Cron Generator</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Cron name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="Description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  type="number"
                  label="Interval second"
                  value={form.intervalSecond}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      intervalSecond: Math.max(1, Number(event.target.value || 1)),
                    }))
                  }
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={reset}>
                  New Cron
                </Button>
                <Button variant="contained" onClick={() => void save()}>
                  Save Cron
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => void remove()}
                >
                  Delete Cron
                </Button>
              </Stack>
              <Divider />
              <Typography variant="subtitle2">Assigned Scheduled Scripts</Typography>
              <Stack spacing={0.5}>
                {scripts
                  .filter(
                    (script) =>
                      script.triggerType === "SCHEDULED" &&
                      script.cronId === (selectedId ?? "")
                  )
                  .map((script) => (
                    <Typography key={script.id} variant="body2">
                      {script.name}
                    </Typography>
                  ))}
                {scripts.filter(
                  (script) =>
                    script.triggerType === "SCHEDULED" &&
                    script.cronId === (selectedId ?? "")
                ).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Belum ada script scheduled pada cron ini.
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

function normalizeBindings(
  templateInputs: AnalysisInputRow[],
  existingBindings: AnalysisBindingRow[] | null,
  attributeOptions: AttributeOption[]
): AnalysisBindingRow[] {
  const existingMap = new Map(
    (existingBindings ?? []).map((binding) => [binding.variableName, binding])
  );

  return templateInputs.map((input) => {
    const existing = existingMap.get(input.variableName);
    const sourceType = input.sourceType ?? "attribute";
    const keepExisting = existing?.sourceType === sourceType;
    return resolveLegacyBinding(
      {
      id: input.id,
      variableName: input.variableName,
      sourceType,
      constantType: existing?.constantType ?? input.constantType ?? "string",
      paramKey:
        sourceType === "query" || sourceType === "body"
          ? keepExisting
            ? existing?.paramKey ?? input.paramKey ?? ""
            : input.paramKey ?? ""
          : null,
      assetPath:
        sourceType === "asset"
          ? keepExisting
            ? existing?.assetPath ?? input.assetPath ?? null
            : input.assetPath ?? null
          : null,
      assetId:
        sourceType === "asset"
          ? keepExisting
            ? existing?.assetId ?? input.assetId ?? null
            : input.assetId ?? null
          : null,
      required: input.required ?? existing?.required ?? false,
      attributePath:
        sourceType === "attribute"
          ? keepExisting
            ? existing?.attributePath ?? input.attributePath ?? null
            : input.attributePath ?? null
          : null,
      attributeKey:
        sourceType === "attribute"
          ? keepExisting
            ? existing?.attributeKey ?? input.attributeKey ?? null
            : input.attributeKey ?? null
          : null,
      constantValue:
        sourceType === "constant"
          ? keepExisting
            ? existing?.constantValue ?? input.constantValue ?? ""
            : input.constantValue ?? ""
          : "",
      },
      attributeOptions
    );
  });
}

function buildAttributeOptions(assets: AssetListItem[]): AttributeOption[] {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  const buildPath = (assetId: string) => {
    const parts: string[] = [];
    let current = assetMap.get(assetId);
    while (current) {
      parts.unshift(current.name);
      current = current.parentAssetId
        ? assetMap.get(current.parentAssetId)
        : undefined;
    }
    return parts.join(".");
  };

  const options: AttributeOption[] = [];

  assets.forEach((asset) => {
    const basePath = buildPath(asset.id);
    (asset.attributes ?? []).forEach((attribute) => {
      const templateItem = attribute.templateItem as TemplateItem;
      const fullPath = `${basePath}.${templateItem.name}`;
      const dataType = normalizeAttributeType(templateItem.dataType);
      const key = `${asset.id}::${templateItem.id}`;
      options.push({
        label: fullPath,
        value: key,
        dataType,
        unit: templateItem.unit ?? "",
        alias: templateItem.name,
        path: fullPath,
      });
    });
  });

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

function buildAssetOptions(assets: AssetListItem[]): AssetOption[] {
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  const buildPath = (assetId: string) => {
    const parts: string[] = [];
    let current = assetMap.get(assetId);
    while (current) {
      parts.unshift(current.name);
      current = current.parentAssetId
        ? assetMap.get(current.parentAssetId)
        : undefined;
    }
    return parts.join(".");
  };

  return assets
    .map((asset) => ({
      label: buildPath(asset.id),
      value: asset.id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function resolveLegacyBinding(
  binding: AnalysisBindingRow,
  attributeOptions: AttributeOption[]
): AnalysisBindingRow {
  const matchByKey = binding.attributeKey
    ? attributeOptions.find((option) => option.value === binding.attributeKey)
    : null;
  if (matchByKey) {
    return {
      ...binding,
      attributePath: matchByKey.path,
    };
  }
  if (!binding.attributePath) {
    return binding;
  }
  const matchByPath = attributeOptions.find(
    (option) => option.path === binding.attributePath
  );
  if (!matchByPath) {
    return binding;
  }
  return {
    ...binding,
    attributeKey: matchByPath.value,
    attributePath: matchByPath.path,
  };
}

function normalizeAttributeType(dataType: TemplateItem["dataType"]): string {
  switch (dataType) {
    case "STRING":
      return "string";
    case "NUMBER":
      return "number";
    case "BOOLEAN":
      return "boolean";
    case "ARRAY":
      return "array";
    case "OBJECT":
      return "object";
    case "JSON":
    default:
      return "object";
  }
}
