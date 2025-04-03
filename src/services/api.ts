import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

const API_URL = 'http://localhost:5000/api';

// Create an instance for internal API calls
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create an instance for external API calls (no baseURL)
export const externalApi = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Add request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out'));
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling (for both instances)
const errorInterceptor = async (error: any) => {
  if (error.code === 'ECONNABORTED') {
    console.error('Request timed out:', error);
    throw new Error('Request timed out. Please try again.');
  }
  
  if (!error.response) {
    console.error('Network error:', error);
    throw new Error('Network error. Please check your connection.');
  }

  throw error;
};

externalApi.interceptors.response.use(
  (response) => response,
  errorInterceptor
);

export const auth = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        name,
        email,
        password,
      });
      return response.data;
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  },

  async getCurrentUser(): Promise<{ user: User }> {
    try {
      const response = await api.get<{ user: User }>('/auth/me');
      return response.data;
    } catch (error: any) {
      console.error('Get current user error:', error);
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  },
};

export default api; 