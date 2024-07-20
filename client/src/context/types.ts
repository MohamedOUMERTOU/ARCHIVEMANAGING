// context/types.ts

export interface Document {
  id: string;
  name: string;
  type: string;
  date: string;
}

export interface User {
  name: string;
  password: string;
  profile_id?: number;
}