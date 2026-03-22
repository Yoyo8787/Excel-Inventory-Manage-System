export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
};

export const stripExtension = (filename: string): string => {
  return filename.replace(/\.[^.]+$/, '');
};
