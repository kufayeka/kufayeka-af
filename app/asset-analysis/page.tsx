"use client";

import Link from "next/link";
import { Box, Button, CssBaseline, Stack, Typography } from "@mui/material";

export default function AssetAnalysisPage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex" }}>
      <CssBaseline />
      <Stack spacing={2} sx={{ m: "auto", textAlign: "center", maxWidth: 520 }}>
        <Typography variant="h5">Asset analysis pages moved</Typography>
        <Typography color="text.secondary">
          Gunakan halaman baru di bawah ini.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button component={Link} href="/asset-analyse" variant="contained">
            Asset Analyse
          </Button>
          <Button
            component={Link}
            href="/asset-analyses-template"
            variant="outlined"
          >
            Asset Analyses Template
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

