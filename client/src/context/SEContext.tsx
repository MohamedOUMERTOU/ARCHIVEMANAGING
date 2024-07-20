import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape of your context value
interface SEContextType {
  data: any; // Replace 'any' with your data type
  fetchData: () => void;
  // Add other methods or properties as needed
}

// Create the context with default values
const SEContext = createContext<SEContextType | undefined>(undefined);

// Create a custom hook to use the context
export const useSEContext = () => {
  const context = useContext(SEContext);
  if (context === undefined) {
    throw new Error('useSEContext must be used within a SEContextProvider');
  }
  return context;
};

// Define the provider component
export const SEContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<any>(null); // Replace 'any' with your data type

  // Define the function to fetch data from API
  const fetchData = async () => {
    try {
      const response = await fetch('/api/endpoint'); // Replace with your API endpoint
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <SEContext.Provider value={{ data, fetchData }}>
      {children}
    </SEContext.Provider>
  );
};
