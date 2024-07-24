// SEContext.tsx

import React, { createContext, ReactNode, useState, FC, Dispatch, SetStateAction } from "react";
import { MenuItem, User } from "./Types";



export const SEContextProvider: FC<SEContextProviderProps> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [axes, setAxes] = useState<MenuItem[]>([]);

  return (
    <SEContext.Provider value={{ axes, setAxes,users, setUsers }}>
      {children}
    </SEContext.Provider>
  );
};

export const useSEContext = () => {
  const context = React.useContext(SEContext);
  if (!context) {
    throw new Error("useSEContext must be used within a SEContextProvider");
  }
  return context;
};


// Define the context type
interface SEContextType {
  users: User[];
  axes: MenuItem[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  setAxes: Dispatch<SetStateAction<MenuItem[]>>;
}

export const SEContext = createContext<SEContextType | undefined>(undefined);

interface SEContextProviderProps {
  children: ReactNode;
}