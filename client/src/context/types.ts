// types.ts

import { Icons } from "../core/SEIcons";

export interface User {
    id: number;
    name: string;
    email: string;
    role?: string; // Add other fields as needed
  }

  export interface Action {
    idOperation: number;
    name: string;
    description: string;
    
  }

  type IconKeys = keyof typeof Icons;
 export interface MenuItem {
    idMenu: number;
    icon?: IconKeys;
    nom: string;
    discription: string;
    parentId: number;
    subMenus?: MenuItem[];
  }