interface ApiErrorBody {
  detail?: string;
}

interface ApiErrorLike {
  response?: {
    data?: ApiErrorBody;
  };
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiErrorLike;
  return apiError.response?.data?.detail || fallback;
}
