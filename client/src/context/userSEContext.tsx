import React, { createContext, Dispatch, FC, ReactNode, SetStateAction, useState } from "react";
import { Action, MenuItem, User } from "./types";

export const SEContextProvider: FC<SEContextProviderProps> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [axes, setAxes] = useState<MenuItem[]>([]);
  const [actions, setActions] = useState<Action[]>([]); // Corrected typo here

  return (
    <SEContext.Provider value={{ axes, setAxes, users, setUsers, actions, setActions }}>
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
  actions: Action[]; // Corrected typo here
  setUsers: Dispatch<SetStateAction<User[]>>;
  setAxes: Dispatch<SetStateAction<MenuItem[]>>;
  setActions: Dispatch<SetStateAction<Action[]>>; // Corrected typo here
}

export const SEContext = createContext<SEContextType | undefined>(undefined);

interface SEContextProviderProps {
  children: ReactNode;
}



