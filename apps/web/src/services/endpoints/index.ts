// Chemins de l'API Spring Boot, regroupés par domaine (relatifs à VITE_API_BASE_URL)
export const endpoints = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
  },
  classification: {
    tree: '/classification/tree',
    node: (id: string) => `/classification/${id}`,
  },
  documents: {
    list: '/documents',
    one: (id: string) => `/documents/${id}`,
    classify: (id: string) => `/documents/${id}/classify`,
    reclassify: (id: string) => `/documents/${id}/reclassify`,
    versions: (id: string) => `/documents/${id}/versions`,
    content: (id: string, versionNo: number) => `/documents/${id}/versions/${String(versionNo)}/content`,
    viewLink: (id: string, versionNo: number) => `/documents/${id}/versions/${String(versionNo)}/view-link`,
    events: (id: string) => `/documents/${id}/events`,
    requests: (id: string) => `/documents/${id}/requests`,
  },
  documentTypes: '/document-types',
  tags: '/tags',
  audit: {
    list: '/audit',
    verify: '/audit/verify',
  },
} as const;
