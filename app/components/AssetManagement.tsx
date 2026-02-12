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
import type {
  AssetAttributeInput,
  AssetSummary,
  TemplateSummary,
} from "../data/assetData";

export type AssetManagementProps = {
  assetForm: {
    name: string;
    description: string;
    parentAssetId: string;
    assetAttributeTemplateId: string;
  };
  assets: AssetSummary[];
  templates: TemplateSummary[];
  attributeValues: AssetAttributeInput[];
  onAssetFieldChange: (field: "name" | "description", value: string) => void;
  onTemplateChange: (event: SelectChangeEvent<string>) => void;
  onParentAssetChange: (event: SelectChangeEvent<string>) => void;
  onAttributeValueChange: (templateItemId: string, value: string) => void;
  onCreateAsset: () => void;
  onUpdateAsset: () => void;
  onDeleteAsset: () => void;
  onSaveAttributes: () => void;
};

export function AssetManagement({
  assetForm,
  assets,
  templates,
  attributeValues,
  onAssetFieldChange,
  onTemplateChange,
  onParentAssetChange,
  onAttributeValueChange,
  onCreateAsset,
  onUpdateAsset,
  onDeleteAsset,
  onSaveAttributes,
}: AssetManagementProps) {
  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Asset Details
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Nama asset"
              placeholder="Contoh: Pump-01"
              aria-label="Nama asset"
              title="Nama asset"
              fullWidth
              value={assetForm.name}
              onChange={(event) =>
                onAssetFieldChange("name", event.target.value)
              }
            />
            <TextField
              label="Deskripsi"
              placeholder="Deskripsi singkat"
              aria-label="Deskripsi asset"
              title="Deskripsi asset"
              fullWidth
              multiline
              minRows={3}
              value={assetForm.description}
              onChange={(event) =>
                onAssetFieldChange("description", event.target.value)
              }
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="parent-asset-label">Parent asset</InputLabel>
                <Select
                  labelId="parent-asset-label"
                  label="Parent asset"
                  aria-label="Parent asset"
                  title="Parent asset"
                  value={assetForm.parentAssetId}
                  onChange={onParentAssetChange}
                >
                  <MenuItem value="">(Tidak ada)</MenuItem>
                  {assets.map((asset) => (
                    <MenuItem key={asset.id} value={asset.id}>
                      {asset.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="template-label">Template</InputLabel>
                <Select
                  labelId="template-label"
                  label="Template"
                  aria-label="Template asset"
                  title="Template asset"
                  value={assetForm.assetAttributeTemplateId}
                  onChange={onTemplateChange}
                >
                  <MenuItem value="">(Tanpa template)</MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                variant="contained"
                aria-label="Simpan asset"
                title="Simpan asset"
                onClick={onCreateAsset}
              >
                Save Asset
              </Button>
              <Button
                variant="outlined"
                aria-label="Update asset"
                title="Update asset"
                onClick={onUpdateAsset}
              >
                Update Asset
              </Button>
              <Button
                variant="outlined"
                color="error"
                aria-label="Hapus asset"
                title="Hapus asset"
                onClick={onDeleteAsset}
              >
                Delete Asset
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Asset Attributes
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Filter attribute"
              placeholder="Cari attribute"
              aria-label="Filter attribute"
              title="Filter attribute"
              fullWidth
              size="small"
            />
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
              aria-label="Tabel attribute asset"
            >
              <Box component="thead">
                <Box component="tr">
                  <Box component="th">Attribute</Box>
                  <Box component="th">Tipe</Box>
                  <Box component="th">Unit</Box>
                  <Box component="th">Value</Box>
                </Box>
              </Box>
              <Box component="tbody">
                {attributeValues.map((attribute) => (
                  <Box component="tr" key={attribute.templateItemId}>
                    <Box component="td">{attribute.templateItem.name}</Box>
                    <Box component="td">
                      {formatAttributeType(attribute.templateItem.dataType)}
                    </Box>
                    <Box component="td">{attribute.templateItem.unit || "-"}</Box>
                    <Box component="td">
                      <TextField
                        size="small"
                        label="Value"
                        aria-label={`Nilai ${attribute.templateItem.name}`}
                        title={`Nilai ${attribute.templateItem.name}`}
                        value={attribute.value ?? ""}
                        onChange={(event) =>
                          onAttributeValueChange(
                            attribute.templateItemId,
                            event.target.value
                          )
                        }
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
            <Button
              variant="contained"
              aria-label="Simpan attribute asset"
              title="Simpan attribute asset"
              onClick={onSaveAttributes}
            >
              Save Attributes
            </Button>
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
