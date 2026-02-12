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
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { AppHeader } from "../components/AppHeader";
import type { AssetListItem, TemplateItem } from "../data/assetData";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

type AnalysisInputRow = {
  id: string;
  variableName: string;
  sourceType: "attribute" | "constant";
  constantType: "number" | "boolean" | "string" | "array" | "object";
  attributePath: string | null;
  attributeKey?: string | null;
  constantValue: string | number | boolean;
};

type ScriptTemplate = {
  id: string;
  name: string;
  description: string | null;
  script: string;
  inputs: AnalysisInputRow[] | null;
};

type AttributeOption = {
  label: string;
  value: string;
  dataType: string;
  unit: string;
  alias: string;
  path: string;
};

export default function AssetAnalysesTemplatePage() {
  const [templates, setTemplates] = useState<ScriptTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    script: "// Write analysis script template here\n",
    inputs: [] as AnalysisInputRow[],
  });
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const attributeOptions = useMemo(
    () => buildAttributeOptions(assets),
    [assets]
  );

  useEffect(() => {
    if (attributeOptions.length === 0) return;
    setTemplateForm((prev) => ({
      ...prev,
      inputs: prev.inputs.map((input) =>
        resolveLegacyInput(input, attributeOptions)
      ),
    }));
  }, [attributeOptions]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) {
      return templates;
    }
    const keyword = templateSearch.trim().toLowerCase();
    return templates.filter((item) =>
      [item.name, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [templateSearch, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const variableCompletionSource = (context: CompletionContext) => {
    const word = context.matchBefore(/\w+(?:\.\w+)*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    const completions: Completion[] = templateForm.inputs
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

  const handleSelectTemplate = (template: ScriptTemplate) => {
    setSelectedTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      description: template.description ?? "",
      script: template.script,
      inputs: normalizeTemplateInputs(template.inputs, attributeOptions),
    });
  };

  const handleAddInput = () => {
    setTemplateForm((prev) => ({
      ...prev,
      inputs: [
        ...prev.inputs,
        {
          id: crypto.randomUUID(),
          variableName: "",
          sourceType: "attribute",
          constantType: "string",
          attributePath: null,
          attributeKey: null,
          constantValue: "",
        },
      ],
    }));
  };

  const handleUpdateInput = (
    index: number,
    changes: Partial<AnalysisInputRow>
  ) => {
    setTemplateForm((prev) => ({
      ...prev,
      inputs: prev.inputs.map((item, idx) =>
        idx === index ? { ...item, ...changes } : item
      ),
    }));
  };

  const handleRemoveInput = (index: number) => {
    setTemplateForm((prev) => ({
      ...prev,
      inputs: prev.inputs.filter((_, idx) => idx !== index),
    }));
  };

  const resetForm = () => {
    setSelectedTemplateId(null);
    setTemplateForm({
      name: "",
      description: "",
      script: "// Write analysis script template here\n",
      inputs: [],
    });
  };

  const handleSave = async () => {
    if (!templateForm.name.trim()) {
      setErrorMessage("Nama template wajib diisi.");
      return;
    }

    if (!templateForm.script.trim()) {
      setErrorMessage("Script tidak boleh kosong.");
      return;
    }

    try {
      const response = await fetch(
        selectedTemplateId
          ? `/api/analysis-script-templates/${selectedTemplateId}`
          : "/api/analysis-script-templates",
        {
          method: selectedTemplateId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateForm.name,
            description: templateForm.description || null,
            script: templateForm.script,
            inputs: templateForm.inputs,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Gagal menyimpan template");
      }

      await refreshTemplates();
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menyimpan template.");
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) {
      setErrorMessage("Pilih template terlebih dahulu.");
      return;
    }

    if (!window.confirm("Hapus template ini?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/analysis-script-templates/${selectedTemplateId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Gagal delete template");
      }

      await refreshTemplates();
      resetForm();
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal menghapus template.");
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
        await Promise.all([refreshTemplates(), refreshAssets()]);
      } catch (error) {
        console.error(error);
        setErrorMessage("Gagal memuat data template.");
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
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    setTemplateForm({
      name: selectedTemplate.name,
      description: selectedTemplate.description ?? "",
      script: selectedTemplate.script,
      inputs: normalizeTemplateInputs(selectedTemplate.inputs, attributeOptions),
    });
  }, [selectedTemplate, attributeOptions]);

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <CssBaseline />
      <AppHeader />
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
          aria-label="Template explorer"
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Analysis Template Explorer
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Cari template"
              placeholder="Ketik nama template"
              aria-label="Cari template"
              title="Cari template"
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                aria-label="Buat template baru"
                title="Buat template baru"
                onClick={resetForm}
              >
                New Template
              </Button>
              <Button
                variant="contained"
                aria-label="Simpan template"
                title="Simpan template"
                onClick={handleSave}
              >
                Save
              </Button>
            </Stack>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflow: "auto" }}>
            <Stack spacing={1} sx={{ p: 2 }} aria-label="Daftar template">
              {filteredTemplates.map((item) => (
                <Card
                  key={item.id}
                  variant="outlined"
                  sx={{
                    borderColor:
                      item.id === selectedTemplateId
                        ? "primary.light"
                        : "divider",
                    bgcolor:
                      item.id === selectedTemplateId
                        ? "primary.50"
                        : "background.paper",
                  }}
                >
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Box>
                        <Typography variant="subtitle2">{item.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.description || "No description"}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label="Pilih template"
                        title="Pilih template"
                        onClick={() => handleSelectTemplate(item)}
                        size="small"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        </Box>

        <Box
          component="section"
          sx={{ width: "70%", height: "100%", overflow: "auto", p: 3 }}
          aria-label="Template workspace"
        >
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Attributes</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                      label="Template name"
                      aria-label="Template name"
                      title="Template name"
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                    <TextField
                      label="Template description"
                      aria-label="Template description"
                      title="Template description"
                      value={templateForm.description}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="subtitle1">Variable bindings</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      aria-label="Tambah input variable"
                      title="Tambah input variable"
                      onClick={handleAddInput}
                    >
                      Add Input
                    </Button>
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
                          <TableCell align="center" sx={{ width: 72 }}>
                            Action
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {templateForm.inputs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                Belum ada input. Tambahkan variable binding.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          templateForm.inputs.map((input, index) => (
                            <TableRow key={input.id}>
                              <TableCell>
                                <TextField
                                  size="small"
                                  label="Variable"
                                  aria-label="Variable"
                                  title="Variable"
                                  value={input.variableName}
                                  onChange={(event) =>
                                    handleUpdateInput(index, {
                                      variableName: event.target.value,
                                    })
                                  }
                                  fullWidth
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  select
                                  size="small"
                                  label="Source"
                                  aria-label="Binding source"
                                  title="Binding source"
                                  value={input.sourceType}
                                  onChange={(event) =>
                                    handleUpdateInput(index, {
                                      sourceType: event.target.value as
                                        | "attribute"
                                        | "constant",
                                      attributePath:
                                        event.target.value === "attribute"
                                          ? input.attributePath
                                          : null,
                                      attributeKey:
                                        event.target.value === "attribute"
                                          ? input.attributeKey ?? null
                                          : null,
                                      constantValue:
                                        event.target.value === "constant"
                                          ? input.constantValue
                                          : "",
                                    })
                                  }
                                  fullWidth
                                >
                                  <MenuItem value="attribute">Attribute</MenuItem>
                                  <MenuItem value="constant">Constant</MenuItem>
                                </TextField>
                              </TableCell>
                              <TableCell>
                                {input.sourceType === "attribute" ? (
                                  <TextField
                                    size="small"
                                    label="Type"
                                    aria-label="Attribute type"
                                    title="Attribute type"
                                    value={
                                      input.attributeKey
                                        ? attributeOptions.find(
                                            (option) =>
                                              option.value ===
                                              input.attributeKey
                                          )?.dataType ?? ""
                                        : input.attributePath
                                          ? attributeOptions.find(
                                              (option) =>
                                                option.path ===
                                                input.attributePath
                                            )?.dataType ?? ""
                                          : ""
                                    }
                                    InputProps={{ readOnly: true }}
                                    fullWidth
                                  />
                                ) : (
                                  <TextField
                                    select
                                    size="small"
                                    label="Type"
                                    aria-label="Constant type"
                                    title="Constant type"
                                    value={input.constantType}
                                    onChange={(event) =>
                                      handleUpdateInput(index, {
                                        constantType: event.target
                                          .value as AnalysisInputRow["constantType"],
                                        constantValue: "",
                                      })
                                    }
                                    fullWidth
                                  >
                                    <MenuItem value="string">String</MenuItem>
                                    <MenuItem value="number">Number</MenuItem>
                                    <MenuItem value="boolean">Boolean</MenuItem>
                                    <MenuItem value="array">Array</MenuItem>
                                    <MenuItem value="object">Object</MenuItem>
                                  </TextField>
                                )}
                              </TableCell>
                              <TableCell>
                                {input.sourceType === "attribute" ? (
                                  <Autocomplete
                                    options={attributeOptions}
                                    value={
                                      input.attributeKey
                                        ? attributeOptions.find(
                                            (option) =>
                                              option.value ===
                                              input.attributeKey
                                          ) ?? null
                                        : input.attributePath
                                          ? attributeOptions.find(
                                              (option) =>
                                                option.path ===
                                                input.attributePath
                                            ) ?? null
                                          : null
                                    }
                                    onChange={(_, value) =>
                                      handleUpdateInput(index, {
                                        attributePath: value?.path ?? null,
                                        attributeKey: value?.value ?? null,
                                      })
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
                                ) : (
                                  input.constantType === "boolean" ? (
                                    <TextField
                                      select
                                      size="small"
                                      label="Constant"
                                      aria-label="Constant"
                                      title="Constant"
                                      value={
                                        input.constantValue === true
                                          ? "true"
                                          : input.constantValue === false
                                          ? "false"
                                          : ""
                                      }
                                      onChange={(event) =>
                                        handleUpdateInput(index, {
                                          constantValue:
                                            event.target.value === "true",
                                        })
                                      }
                                      fullWidth
                                    >
                                      <MenuItem value="true">true</MenuItem>
                                      <MenuItem value="false">false</MenuItem>
                                    </TextField>
                                  ) : (
                                    <TextField
                                      size="small"
                                      label={
                                        input.constantType === "array" ||
                                        input.constantType === "object"
                                          ? "Constant (JSON)"
                                          : "Constant"
                                      }
                                      aria-label="Constant"
                                      title="Constant"
                                      value={
                                        typeof input.constantValue === "boolean"
                                          ? input.constantValue
                                            ? "true"
                                            : "false"
                                          : input.constantValue
                                      }
                                      onChange={(event) =>
                                        handleUpdateInput(index, {
                                          constantValue:
                                            input.constantType === "number"
                                              ? Number(event.target.value)
                                              : event.target.value,
                                        })
                                      }
                                      type={
                                        input.constantType === "number"
                                          ? "number"
                                          : "text"
                                      }
                                      multiline={
                                        input.constantType === "array" ||
                                        input.constantType === "object"
                                      }
                                      minRows={
                                        input.constantType === "array" ||
                                        input.constantType === "object"
                                          ? 2
                                          : undefined
                                      }
                                      fullWidth
                                    />
                                  )
                                )}
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  aria-label="Hapus input"
                                  title="Hapus input"
                                  onClick={() => handleRemoveInput(index)}
                                  size="small"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
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
                  <Typography variant="h6">Script Template Editor</Typography>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      overflow: "hidden",
                    }}
                  >
                    <CodeMirror
                      value={templateForm.script}
                      height="360px"
                      extensions={[
                        javascript(),
                        autocompletion({ override: [variableCompletionSource] }),
                      ]}
                      onChange={(value) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          script: value,
                        }))
                      }
                      aria-label="Editor script template"
                    />
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Button
                      variant="contained"
                      aria-label="Simpan template"
                      title="Simpan template"
                      onClick={handleSave}
                    >
                      Save Template
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      aria-label="Hapus template"
                      title="Hapus template"
                      onClick={handleDelete}
                    >
                      Delete Template
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
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

function normalizeTemplateInputs(
  inputs: AnalysisInputRow[] | null,
  attributeOptions: AttributeOption[]
): AnalysisInputRow[] {
  return (inputs ?? []).map((input) =>
    resolveLegacyInput(
      {
        id: input.id ?? crypto.randomUUID(),
        variableName: input.variableName ?? "",
        sourceType: input.sourceType ?? "attribute",
        constantType: input.constantType ?? "string",
        attributePath: input.attributePath ?? null,
        attributeKey: input.attributeKey ?? null,
        constantValue: input.constantValue ?? "",
      },
      attributeOptions
    )
  );
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

function resolveLegacyInput(
  input: AnalysisInputRow,
  attributeOptions: AttributeOption[]
): AnalysisInputRow {
  const matchByKey = input.attributeKey
    ? attributeOptions.find((option) => option.value === input.attributeKey)
    : null;
  if (matchByKey) {
    return {
      ...input,
      attributePath: matchByKey.path,
    };
  }
  if (!input.attributePath) {
    return input;
  }
  const matchByPath = attributeOptions.find(
    (option) => option.path === input.attributePath
  );
  if (!matchByPath) {
    return input;
  }
  return {
    ...input,
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

