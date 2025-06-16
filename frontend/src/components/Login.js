import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Person } from '@mui/icons-material';
import { validateCredentials, createSession } from '../utils/auth';

function Login({ onLogin }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate credentials using encrypted authentication
    if (validateCredentials(credentials.username, credentials.password)) {
      // Create secure session
      createSession();
      onLogin(true);
    } else {
      setError('Invalid username or password');
    }
    
    setIsLoading(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 200px)',
        backgroundColor: 'background.default',
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          minWidth: 400,
          maxWidth: 500,
          borderRadius: 2,
          background: 'linear-gradient(145deg, #1e1e1e 0%, #2d2d2d 100%)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Lock sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Admin Login
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Access the secure user area
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            name="username"
            value={credentials.username}
            onChange={handleChange}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Person />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={credentials.password}
            onChange={handleChange}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={togglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading}
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        <Box sx={{ mt: 3, p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" color="textSecondary" display="block">
            <strong>Admin Access Required</strong>
          </Typography>
          <Typography variant="caption" color="textSecondary" display="block">
            Contact administrator for credentials
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default Login; 