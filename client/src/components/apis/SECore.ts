// src/core/SECore.ts
import axios, {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

// Create an Axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: "https://api.example.com", // Replace with your API base URL
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptors for request
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add authorization token or other headers here if needed
    // Example: config.headers['Authorization'] = `Bearer ${yourToken}`;
    return config;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

// Interceptors for response
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: any) => {
    // Handle errors here, e.g., logging, showing notifications, etc.
    return Promise.reject(error);
  }
);

export const SECore = {
  get: async <T>(
    url: string,
    config?: InternalAxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosInstance.get<T>(url, config);
    return response.data;
  },

  post: async <T>(
    url: string,
    data: any,
    config?: InternalAxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosInstance.post<T>(url, data, config);
    return response.data;
  },

  put: async <T>(
    url: string,
    data: any,
    config?: InternalAxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosInstance.put<T>(url, data, config);
    return response.data;
  },

  remove: async <T>(
    url: string,
    config?: InternalAxiosRequestConfig
  ): Promise<T> => {
    const response = await axiosInstance.delete<T>(url, config);
    return response.data;
  },
};
