import { Box } from "@mui/material";

export type TabPanelProps = {
  children: React.ReactNode;
  index: number;
  value: number;
};

export function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`asset-template-tabpanel-${index}`}
      aria-labelledby={`asset-template-tab-${index}`}
    >
      {value === index ? <Box sx={{ py: 2 }}>{children}</Box> : null}
    </div>
  );
}
