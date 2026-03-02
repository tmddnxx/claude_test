export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    meta: {
        timestamp: string;
    };
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
    };
    meta: {
        timestamp: string;
    };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
