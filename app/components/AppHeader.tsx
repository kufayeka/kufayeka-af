import { AppBar, Box, Button, Divider, Toolbar, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";

export function AppHeader() {
  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6" component="div">
            Asset Framework UI
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Digital twin asset, template, dan attribute management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          aria-label="Buka pengaturan sistem"
          title="Buka pengaturan sistem"
        >
          Settings
        </Button>
      </Toolbar>
      <Divider />
    </AppBar>
  );
}
