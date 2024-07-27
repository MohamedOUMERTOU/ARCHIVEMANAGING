import React, { createContext, Dispatch, FC, ReactNode, SetStateAction, useState, useContext } from "react";
import { Action, MenuItem, User } from "./types";

interface SEContextType {
  users: User[];
  axes: MenuItem[];
  actions: Action[]; 
  closeDr: boolean;
  setUsers: Dispatch<SetStateAction<User[]>>;
  setAxes: Dispatch<SetStateAction<MenuItem[]>>;
  setActions: Dispatch<SetStateAction<Action[]>>;
  setCloseDr: Dispatch<SetStateAction<boolean>>;
}

export const SEContext = createContext<SEContextType | undefined>(undefined);

export const SEContextProvider: FC<{children: ReactNode}> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [axes, setAxes] = useState<MenuItem[]>([]);
  const [actions, setActions] = useState<Action[]>([]); 
  const [closeDr, setCloseDr] = useState<boolean>(true);

  return (
    <SEContext.Provider value={{ users, setUsers, axes, setAxes, actions, setActions, closeDr, setCloseDr }}>
      {children}
    </SEContext.Provider>
  );
};

export const useSEContext = () => {
  const context = useContext(SEContext);
  if (!context) {
    throw new Error("useSEContext must be used within a SEContextProvider");
  }
  return context;
};

// Define the context provider props type
interface SEContextProviderProps {
  children: ReactNode;
}
