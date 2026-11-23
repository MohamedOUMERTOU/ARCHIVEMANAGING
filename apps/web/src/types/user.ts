export interface Organization {
  id: string;
  code: string;
  name: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  organization: Organization;
  roles: string[];
  /** Permissions générales, ex. "classification.manage" ("*" = tout) */
  permissions: string[];
}

export interface Session {
  accessToken: string;
  user: CurrentUser;
}
