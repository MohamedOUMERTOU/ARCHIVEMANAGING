import { http } from '@/services/api/http';
import { endpoints } from '@/services/endpoints';
import type { ClassificationNode } from '../types';

export const classificationApi = {
  tree: async (): Promise<ClassificationNode[]> => {
    const { data } = await http.get<ClassificationNode[]>(endpoints.classification.tree);
    return data;
  },
};

export const classificationKeys = {
  all: ['classification'] as const,
  tree: () => [...classificationKeys.all, 'tree'] as const,
};
