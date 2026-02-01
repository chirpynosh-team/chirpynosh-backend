/**
 * API Response Types
 */

/**
 * Standard success response wrapper
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string | undefined;
    details?: unknown;
  };
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
