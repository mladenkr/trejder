import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

function Navbar() {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          BTC Trading Bot
        </Typography>
        <Box>
          <Button
            color="inherit"
            component={RouterLink}
            to="/"
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            component={RouterLink}
            to="/history"
          >
            Trading History
          </Button>
          <Button
            color="inherit"
            component={RouterLink}
            to="/settings"
          >
            Settings
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar; 