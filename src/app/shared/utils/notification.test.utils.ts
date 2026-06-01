export const createNotification = (applicationId: string, contentMeta: Array<{ key: string; value: string }>) => ({
  body: {
    applicationId,
    contentMeta,
  },
} as any);
