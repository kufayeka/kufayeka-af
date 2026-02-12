import {
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { TemplateSummary } from "../data/assetData";

export type TemplateManagementProps = {
  templates: TemplateSummary[];
  selectedTemplateId: string;
  selectedTemplate?: TemplateSummary;
  selectedItemId: string | null;
  templateForm: {
    name: string;
    description: string;
  };
  itemForm: {
    name: string;
    dataType: string;
    unit: string;
    description: string;
    defaultValue: string;
  };
  onTemplateSelect: (event: SelectChangeEvent<string>) => void;
  onTemplateFieldChange: (field: "name" | "description", value: string) => void;
  onItemFieldChange: (
    field: "name" | "dataType" | "unit" | "description" | "defaultValue",
    value: string
  ) => void;
  onSelectItem: (itemId: string) => void;
  onCreateTemplate: () => void;
  onUpdateTemplate: () => void;
  onDeleteTemplate: () => void;
  onAddItem: () => void;
  onUpdateItem: () => void;
  onDeleteItem: () => void;
};

export function TemplateManagement({
  templates,
  selectedTemplateId,
  selectedTemplate,
  selectedItemId,
  templateForm,
  itemForm,
  onTemplateSelect,
  onTemplateFieldChange,
  onItemFieldChange,
  onSelectItem,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: TemplateManagementProps) {
  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Template Selector
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="template-management-label">
              Pilih template
            </InputLabel>
            <Select
              labelId="template-management-label"
              label="Pilih template"
              aria-label="Pilih template"
              title="Pilih template"
              value={selectedTemplateId}
              onChange={onTemplateSelect}
            >
              <MenuItem value="">(Buat baru)</MenuItem>
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Template Details
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Nama template"
              placeholder="Contoh: Pump"
              aria-label="Nama template"
              title="Nama template"
              fullWidth
              value={templateForm.name}
              onChange={(event) =>
                onTemplateFieldChange("name", event.target.value)
              }
            />
            <TextField
              label="Deskripsi"
              placeholder="Deskripsi template"
              aria-label="Deskripsi template"
              title="Deskripsi template"
              fullWidth
              multiline
              minRows={3}
              value={templateForm.description}
              onChange={(event) =>
                onTemplateFieldChange("description", event.target.value)
              }
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                aria-label="Simpan template"
                title="Simpan template"
                onClick={onCreateTemplate}
              >
                Save Template
              </Button>
              <Button
                variant="outlined"
                aria-label="Update template"
                title="Update template"
                onClick={onUpdateTemplate}
              >
                Update Template
              </Button>
              <Button
                variant="outlined"
                color="error"
                aria-label="Hapus template"
                title="Hapus template"
                onClick={onDeleteTemplate}
              >
                Delete Template
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Template Items
          </Typography>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nama attribute"
                placeholder="pressure"
                aria-label="Nama attribute"
                title="Nama attribute"
                fullWidth
                value={itemForm.name ?? ""}
                onChange={(event) =>
                  onItemFieldChange("name", event.target.value)
                }
              />
              <FormControl fullWidth>
                <InputLabel id="data-type-label">Data type</InputLabel>
                <Select
                  labelId="data-type-label"
                  label="Data type"
                  aria-label="Data type attribute"
                  title="Data type attribute"
                  value={itemForm.dataType}
                  onChange={(event) =>
                    onItemFieldChange("dataType", event.target.value)
                  }
                >
                  <MenuItem value="STRING">STRING</MenuItem>
                  <MenuItem value="NUMBER">NUMBER</MenuItem>
                  <MenuItem value="BOOLEAN">BOOLEAN</MenuItem>
                  <MenuItem value="ARRAY">ARRAY</MenuItem>
                  <MenuItem value="OBJECT">OBJECT</MenuItem>
                  <MenuItem value="JSON">JSON</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Unit"
                placeholder="bar"
                aria-label="Unit attribute"
                title="Unit attribute"
                fullWidth
                value={itemForm.unit ?? ""}
                onChange={(event) =>
                  onItemFieldChange("unit", event.target.value)
                }
              />
            </Stack>
            <TextField
              label="Deskripsi"
              placeholder="Penjelasan attribute"
              aria-label="Deskripsi attribute"
              title="Deskripsi attribute"
              fullWidth
              multiline
              minRows={2}
              value={itemForm.description ?? ""}
              onChange={(event) =>
                onItemFieldChange("description", event.target.value)
              }
            />
            <TextField
              label="Default value"
              placeholder="Contoh: 0 atau JSON"
              aria-label="Default value"
              title="Default value"
              fullWidth
              value={itemForm.defaultValue ?? ""}
              onChange={(event) =>
                onItemFieldChange("defaultValue", event.target.value)
              }
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                aria-label="Tambah item template"
                title="Tambah item template"
                onClick={onAddItem}
              >
                Add Item
              </Button>
              <Button
                variant="outlined"
                aria-label="Update item template"
                title="Update item template"
                onClick={onUpdateItem}
              >
                Update Item
              </Button>
              <Button
                variant="outlined"
                color="error"
                aria-label="Hapus item template"
                title="Hapus item template"
                onClick={onDeleteItem}
              >
                Delete Item
              </Button>
            </Stack>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                "& th, & td": {
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  textAlign: "left",
                  py: 1,
                  px: 1,
                },
              }}
              aria-label="Tabel item template"
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Attribute</Box>
                  <Box component="th">Type</Box>
                  <Box component="th">Unit</Box>
                  <Box component="th">Deskripsi</Box>
                  <Box component="th">Default</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {(selectedTemplate?.items ?? []).map((item) => (
                  <Box
                    component="tr"
                    key={item.id}
                    onClick={() => onSelectItem(item.id)}
                    sx={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedItemId === item.id
                          ? "action.selected"
                          : "transparent",
                    }}
                    aria-label={`Pilih item template ${item.name}`}
                    title={`Pilih item template ${item.name}`}
                  >
                    <Box component="td">{item.name}</Box>
                    <Box component="td">{formatAttributeType(item.dataType)}</Box>
                    <Box component="td">{item.unit || "-"}</Box>
                    <Box component="td">{item.description}</Box>
                    <Box component="td">
                      {item.defaultValue === null || item.defaultValue === undefined
                        ? "-"
                        : typeof item.defaultValue === "string"
                        ? item.defaultValue
                        : JSON.stringify(item.defaultValue)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

function formatAttributeType(dataType: string) {
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
